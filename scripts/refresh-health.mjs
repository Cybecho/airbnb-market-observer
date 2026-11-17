// Runs only after the collector/deployment result. No data-service credentials.
const {
  GITHUB_TOKEN,
  GITHUB_API_URL = "https://api.github.com",
  GITHUB_REPOSITORY,
  GITHUB_RUN_ID,
  REFRESH_RESULT,
} = process.env;
if (
  !GITHUB_TOKEN ||
  !/^[-\w.]+\/[-\w.]+$/.test(GITHUB_REPOSITORY ?? "") ||
  !/^\d+$/.test(GITHUB_RUN_ID ?? "")
)
  throw new Error("Missing GitHub Actions context");
const base = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}`;
const marker = "<!-- amo-official-refresh-health -->";
const run = `https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
async function api(endpoint, method = "GET", body) {
  const response = await fetch(base + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(`Health issue API returned ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const issues = await api(
  "/issues?state=open&creator=github-actions%5Bbot%5D&per_page=100",
);
const existing = issues.find(
  (issue) =>
    !issue.pull_request &&
    issue.user?.login === "github-actions[bot]" &&
    issue.body?.includes(marker),
);
if (REFRESH_RESULT === "success") {
  if (existing) {
    await api(`/issues/${existing.number}/comments`, "POST", {
      body: `공식 데이터 수집·검증·Pages 배포가 복구되었습니다. [실행 확인](${run}).`,
    });
    await api(`/issues/${existing.number}`, "PATCH", {
      state: "closed",
      state_reason: "completed",
    });
  }
  console.log("Official refresh health: successful.");
} else {
  const body = `${marker}\n공식 데이터 자동 갱신 또는 배포가 완료되지 않았습니다. 기존 정상 Pages 배포는 유지됩니다.\n\n[실패 실행 확인](${run})\n\nActions 로그에서 원천 변경·스키마·경계·품질·테스트·배포 오류를 확인하세요. 원본 파일, 비밀키, 개인 자료는 이 이슈에 첨부하지 않습니다. 다음 성공 실행이 이 이슈를 자동으로 닫습니다.`;
  if (existing) await api(`/issues/${existing.number}`, "PATCH", { body });
  else
    await api("/issues", "POST", {
      title: "[자동 갱신] 공식 데이터 배치 확인 필요",
      body,
    });
  console.log("Official refresh health: one deduplicated issue is open.");
}
