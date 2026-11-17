import { test, expect } from "@playwright/test";

test("atlas loads, searches, selects and compares regions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#view=map");
  await expect(
    page.getByRole("heading", { name: "서울 숙박시장을 한눈에", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /서울 행정동 지표 지도/ }),
  ).toBeVisible();
  await expect(page.getByLabel("자치구").locator("option")).toHaveCount(26);
  await page.getByLabel("자치구").selectOption("마포구");
  await expect(page.locator(".map-title .count")).toContainText("/ 16동");
  await page.getByLabel("자치구").selectOption("");
  await page.getByLabel("행정동 검색").fill("청운효자동");
  await page.getByRole("button", { name: "청운효자동", exact: true }).click();
  await expect(page.locator(".profile h2")).toHaveText("청운효자동");
  await page.getByRole("button", { name: "비교에 추가", exact: true }).click();
  await page.getByLabel("행정동 검색").fill("사직동");
  await page.getByRole("button", { name: "사직동", exact: true }).click();
  await page.getByRole("button", { name: "비교에 추가", exact: true }).click();
  await page.getByRole("button", { name: "나란히 비교", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "관심 지역을 같은 기준으로" }),
  ).toBeVisible();
  await expect(page.locator(".compare-cards .card")).toHaveCount(2);
  await expect(page.locator(".compare-cards")).toContainText("청운효자동");
  await expect(page.locator(".compare-cards")).toContainText("사직동");
  await expect(
    page.getByRole("img", { name: "월별 외국인 존재인구 추세" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("trends and evidence panels retain detailed data", async ({ page }) => {
  await page.goto("/#view=map");
  await expect(
    page.getByRole("heading", { name: "서울 숙박시장을 한눈에" }),
  ).toBeVisible();
  await page.locator(".nav-more > summary").click();
  await page.getByRole("button", { name: "월별 추세", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "외국인 존재인구의 흐름" }),
  ).toBeVisible();
  await page.getByLabel("추세 기간").selectOption("12");
  await expect(page.locator(".trend-card .subtle")).toContainText(
    "관측 기간 12개월",
  );
  await page.getByLabel("요일 구분").selectOption("weekend");
  await page.getByRole("button", { name: "14시", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "14시", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "고객 · 방문자", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "거주지역별 공유숙박 이용자" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "공유숙박 1인·1박 지출" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "매출 근거", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "여관 카드추정매출 · 점포당 월환산" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "월세 계약 비교" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "등록 공급", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "467개 법정동 등록 현황" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "자료 연결", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "자료 출처" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "연결한 자료", level: 2, exact: true }),
  ).toBeVisible();
});

test("legacy and overlay imports stay local, validate, and clear", async ({
  page,
  request,
}) => {
  await page.goto("/#view=map");
  await expect(
    page.getByRole("heading", { name: "서울 숙박시장을 한눈에" }),
  ).toBeVisible();
  const dashboard = await (await request.get("/data/dashboard.json")).json();
  const extensions = await (await request.get("/data/extensions.json")).json();
  const writes: string[] = [];
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url());
  });
  const input = page.getByLabel("연결할 파일");
  await input.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toHaveText("파일 형식 또는 내용이 올바르지 않습니다.");
  dashboard.rows[0].m3_2026_jan_oct_female_pct = 0;
  await input.setInputFiles({
    name: "synthetic-legacy-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ dashboard, extensions })),
  });
  await expect(page.locator(".local-banner")).toBeVisible();
  await page.getByLabel("행정동 검색").fill(dashboard.rows[0].admin_name);
  await page.getByLabel("지도 지표").selectOption("1");
  await page
    .getByRole("button", { name: dashboard.rows[0].admin_name, exact: true })
    .click();
  await expect(page.locator(".profile-value")).toContainText("0%");
  await page.getByRole("button", { name: /연결 해제/ }).click();
  await expect(page.locator(".local-banner")).toHaveCount(0);
  const fixture = {
    schemaVersion: "amo-overlay/1",
    meta: {
      id: "synthetic-e2e",
      title: "E2E 합성 성과",
      provider: "synthetic-test-only",
      observedAt: "2026-11-17",
      geography: "city",
      metricDefinition: "테스트용 합성 데이터. 실제 시장 수치가 아님.",
      occupancyUnit: "percent",
      currency: "KRW",
    },
    marketMonthly: [
      {
        marketId: "test-seoul",
        marketName: "테스트 서울",
        geography: "city",
        month: "2026-01",
        revenue: 0,
        adr: null,
        occupancy: 0,
        activeListings: 0,
        bookedNights: 0,
        availableNights: 0,
        aggregation: "mean",
      },
      {
        marketId: "test-seoul",
        marketName: "테스트 서울",
        geography: "city",
        month: "2026-02",
        revenue: 1000000,
        adr: 100000,
        occupancy: 50,
        activeListings: 1,
        bookedNights: 10,
        availableNights: 20,
        aggregation: "mean",
      },
    ],
    listings: [],
    listingMonthly: [],
    warnings: [],
  };
  await input.setInputFiles({
    name: "synthetic-overlay-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(
    page.getByRole("heading", { name: "E2E 합성 성과" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "시장 월별 성과" }),
  ).toBeVisible();
  await page.getByLabel("성과 지표").selectOption("occupancy");
  await page.getByLabel("성과 집계").selectOption("mean");
  await expect(
    page.locator(".data-table").first().locator("tbody tr"),
  ).toHaveCount(2);
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: /연결 해제/ }).click();
  await expect(page.locator(".local-banner")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "숙소 성과를 보려면 자료를 연결하세요",
    }),
  ).toBeVisible();
});

test("narrow screen has working navigation and no document overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#view=map");
  await expect(
    page.getByRole("heading", { name: "서울 숙박시장을 한눈에" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /서울 행정동 지표 지도/ }),
  ).toBeVisible();
  await page.locator(".nav-more > summary").click();
  for (const name of ["고객 · 방문자", "자료 연결", "지도 탐색"]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
});

test("mobile navigation remains visible after local import, resize and scrolling", async ({
  page,
  request,
}) => {
  await page.goto("/#view=map");
  await expect(
    page.getByRole("heading", { name: "서울 숙박시장을 한눈에", exact: true }),
  ).toBeVisible();
  const dashboard = await (await request.get("/data/dashboard.json")).json();
  const extensions = await (await request.get("/data/extensions.json")).json();
  await page.getByLabel("연결할 파일").setInputFiles({
    name: "synthetic-mobile-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ dashboard, extensions })),
  });
  await expect(page.locator(".local-banner")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(
    page.getByRole("navigation", { name: "주요 탐색" }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "자료 연결", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "연결한 자료와 기준",
      exact: true,
    }),
  ).toBeInViewport();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(
    page.locator(".topbar").getByRole("button", { name: "파일 연결", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
