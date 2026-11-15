import { test, expect } from "@playwright/test";
test("map, filters, domain views and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "지역을 읽는 가장 넓은 시야" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /서울 행정동 지표 지도/ }),
  ).toBeVisible();
  await expect(page.getByLabel("자치구").locator("option")).toHaveCount(26);
  await page.getByLabel("자치구").selectOption("마포구");
  await expect(page.locator(".map-title .count")).toContainText("/ 16동");
  await page.getByLabel("자치구").selectOption("");
  await page
    .getByRole("button", { name: "매출 · 임대료", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "월세 계약 비교", exact: true }),
  ).toBeVisible();
  await page.getByLabel("계약기간").selectOption("2026상반기");
  await page
    .getByRole("button", { name: "고객 · 방문자", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "거주국별 공유숙박 이용자",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "공유숙박 1인·1박 지출", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "공급 · 생활인구", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "467개 법정동 등록 현황", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "데이터 연결", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "원천 출처 카탈로그", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "지도 탐색", exact: true }).click();
  await expect(
    page.getByRole("region", { name: /서울 행정동 지표 지도/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("local import, invalid file, clearing and no upload", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "지역을 읽는 가장 넓은 시야" }),
  ).toBeVisible();
  const d = await (await request.get("/data/dashboard.json")).json();
  const e = await (await request.get("/data/extensions.json")).json();
  const writes: string[] = [];
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url());
  });
  const input = page.locator("input[type=file]");
  await input.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  d.rows[0].m3_2026_jan_oct_female_pct = 0;
  d.rows[0].m3_2026_jan_oct_age_provided_sum_pct = 100.01;
  await input.setInputFiles({
    name: "synthetic-test-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ schemaVersion: "1.0.0", dashboard: d, extensions: e }),
    ),
  });
  await expect(page.locator(".local-banner")).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: /데이터 지우기/ }).click();
  await expect(page.locator(".local-banner")).toHaveCount(0);
});
