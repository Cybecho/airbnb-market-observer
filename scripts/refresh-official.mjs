import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createFetcher, assertGitHubHostedLinux } from "./refresh/io.mjs";
import { derivePresence, sourceLedger } from "./refresh/derive.mjs";
import { refreshPresence } from "./refresh/presence.mjs";
import { refreshRegistry } from "./refresh/registry.mjs";
import { refreshMobility } from "./refresh/mobility.mjs";
import { refreshSales } from "./refresh/sales.mjs";
import { validateAutomation } from "./validate-refresh.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "data/organized");
const now = new Date();
const tempDir = path.join(root, ".refresh-private");
const read = async (name) =>
  JSON.parse(await fs.readFile(path.join(input, name), "utf8"));
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function main() {
  assertGitHubHostedLinux();
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(path.join(root, ".refresh-reports"), { recursive: true });
  let previous = {};
  try {
    previous = await read("insights/refresh-state.json");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const observatory = await read("insights/observatory.json");
  const geometry = await read("geography/seoul-admin.geojson");
  const currentNames = new Map(
    geometry.features.map((f) => [
      String(f.properties.admin_code),
      { gu: f.properties.gu, name: f.properties.admin_name },
    ]),
  );
  const names = new Map(
    observatory.presence.rows.map((r) => [
      r.adminCode,
      { gu: r.gu, name: r.name },
    ]),
  );
  for (const [code, name] of currentNames) names.set(code, name);
  if (previous.boundaryHash && previous.boundaryHash !== hash(geometry))
    throw new Error(
      "Reviewed boundary version changed; refresh-state requires an explicit migration review",
    );
  const { fetchBytes, stats } = createFetcher();
  const shared = { tempDir, now, fetchBytes };
  console.log(
    "Checking four official registration snapshots and latest public sales quarter. No credentials are used.",
  );
  const registryResult = await refreshRegistry({
    ...shared,
    geometry,
    previousState: previous.registry,
  });
  const salesResult = await refreshSales({
    ...shared,
    names: currentNames,
    previousState: previous.sales,
  });
  console.log(
    "Reconciling complete official presence archives, including recent revisions.",
  );
  const presenceResult = await refreshPresence({
    ...shared,
    observatory,
    names,
    previousState: previous.presence,
  });
  const presence = derivePresence(
    presenceResult.observatory,
    currentNames.keys(),
  );
  console.log(
    "Checking the common complete month of official movement sources.",
  );
  const mobilityResult = await refreshMobility({
    ...shared,
    names: currentNames,
    previousState: previous.mobility,
  });
  const checkedAt = now.toISOString();
  const automation = {
    schemaVersion: "1.0",
    status: "success",
    checkedAt,
    schedule: "매주 월요일 06:17 KST",
    sourceRun: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    attribution:
      "서울특별시·KT 및 서울신용보증재단 공식 공개 자료. 공공누리 제1유형. AMO가 집계·코드 연결·기간 비교를 수행함.",
    presence,
    registry: registryResult.registry,
    mobility: mobilityResult.mobility,
    sales: salesResult.sales,
    sources: sourceLedger({
      checkedAt,
      presence,
      registry: registryResult.registry,
      mobility: mobilityResult.mobility,
      sales: salesResult.sales,
    }),
    limitations: [
      "존재 추정·이동·인허가·카드추정매출은 서로 다른 모집단과 분모이다.",
      "설문과 기존 상세 탭은 명시된 과거 조사 스냅샷이다. 자동 갱신 자료와 섞어 최신 자료로 표시하지 않는다.",
      "개인 파일·유료/잠금 값·월세/전세는 이 배치에서 읽거나 저장하지 않는다.",
    ],
  };
  validateAutomation(automation, geometry, presenceResult.observatory);
  const state = {
    schemaVersion: "1.0",
    checkedAt,
    boundaryHash: hash(geometry),
    presence: presenceResult.state,
    registry: registryResult.state,
    mobility: mobilityResult.state,
    sales: salesResult.state,
  };
  // No committed/public file is touched until ALL collectors and semantic checks pass.
  // Any subsequent failure prevents git commit and deployment; the working tree is disposable.
  for (const [name, value] of [
    ["insights/observatory.json", presenceResult.observatory],
    ["insights/automation.json", automation],
    ["insights/refresh-state.json", state],
  ]) {
    const target = path.join(input, name),
      staging = target + ".candidate";
    await fs.writeFile(staging, JSON.stringify(value) + "\n");
    await fs.rename(staging, target);
  }
  const report = {
    checkedAt,
    status: "collected_and_semantically_validated",
    presence: presenceResult.summary,
    registry: registryResult.summary,
    mobility: mobilityResult.summary,
    sales: salesResult.summary,
    network: stats,
    privateRawArtifacts: false,
  };
  await fs.writeFile(
    path.join(root, ".refresh-reports/refresh-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Official data collection\n\n- Checked: ${checkedAt}\n- Presence: ${presence.latestMonth}; ${presenceResult.observatory.presence.rows.length} dong-month aggregates\n- Registry: four source snapshots, ${registryResult.registry.rows.length} mapped administrative dongs\n- Mobility: ${mobilityResult.mobility.od.period}\n- Motel estimated sales: ${salesResult.sales.period}\n- No API keys, private files, raw records, or paid calls\n- Candidate only: commit and deployment still require all tests and publication guards\n`,
    );
  console.log(
    `Collected official data: presence ${presence.latestMonth}, movement ${mobilityResult.mobility.od.period}, sales ${salesResult.sales.period}. Candidate is ready for Linux validation.`,
  );
}
try {
  await main();
} catch (error) {
  console.error(
    `Official refresh stopped; previous public data remains intact. ${error.message}`,
  );
  process.exitCode = 1;
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
