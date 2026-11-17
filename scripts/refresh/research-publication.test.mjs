import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildResearchPublication, validateResearchIndex } from "../research-publication.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ciOnly = process.platform !== "linux" || !process.env.CI;
const expectedAreaKeys = ["code", "gu", "name", "tier", "eligible", "missing", "gates", "values", "context", "reason", "counterpoint", "next", "href"].sort();
const expectedSourceKeys = ["id", "title", "url"].sort();

test("public research publication is reproducible and strictly shaped", { skip: ciOnly }, async () => {
  const first = await buildResearchPublication({ root });
  const second = await buildResearchPublication({ root });
  assert.deepEqual(Buffer.from(JSON.stringify(first)), Buffer.from(JSON.stringify(second)));
  const index = first;
  assert.deepEqual(Object.keys(index).sort(), ["areas", "boundary", "checkedAt", "counts", "methodVersion", "period", "provenance", "schemaVersion", "sources", "thresholds"]);
  assert.equal(index.areas.length, 427);
  assert.equal(index.counts.total, 427);
  for (const area of index.areas) assert.deepEqual(Object.keys(area).sort(), expectedAreaKeys);
  for (const source of index.sources) {
    assert.deepEqual(Object.keys(source).sort(), expectedSourceKeys);
    assert.equal(source.url, `https://data.seoul.go.kr/dataList/${source.id}/S/1/datasetView.do`);
  }
  assert.ok(index.sources.some(source => source.id === "OA-23018"));
  assert.ok(index.sources.some(source => source.id === "OA-16045"));
  assert.equal(index.provenance.path, "data/build-manifest.json");
});

test("publication rejects a month-shaped sales period", { skip: ciOnly }, async () => {
  const index = await buildResearchPublication({ root });
  index.period.sales = "2026-10";
  assert.throws(() => validateResearchIndex(index), /sales quarter/);
});

test("public contract uses exact CSS bindings and authored public links", { skip: ciOnly }, async () => {
  const contract = JSON.parse(await readFile(path.join(root, "public/research/v1/contract.json"), "utf8"));
  const gaps = JSON.parse(await readFile(path.join(root, "public/research/v1/gaps.json"), "utf8"));
  assert.equal(contract.endpoints.index.path, "research/v1/index.json");
  assert.equal(contract.endpoints.gaps.path, "research/v1/gaps.json");
  assert.equal(contract.endpoints.buildProvenance.path, "build-provenance.json");
  assert.equal(gaps.length, 6);
  for (const gap of gaps) {
    for (const key of ["id", "question", "missing", "why", "status", "provider", "procedure", "keyPeriodDenominator", "permissibleConclusion"]) assert.equal(typeof gap[key], "string");
    if ("sourceUrl" in gap) assert.match(gap.sourceUrl, /^https:\/\/data\.seoul\.go\.kr\/dataList\/OA-\d+\/S\/1\/datasetView\.do$/);
  }
  assert.equal(contract.uiBindings.mapArea, '[data-testid="research-map"] path[data-area-code][data-tier]');
  assert.equal(contract.uiBindings.tableArea, '[data-testid="research-table"] a[data-area-code]');
  assert.equal(contract.uiBindings.evidence, '[data-testid="area-evidence"][data-area-code]');
  assert.equal(contract.uiBindings.evidenceTitle, '[data-testid="area-evidence"] h2');
});
