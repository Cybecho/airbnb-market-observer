import { test, expect, type Page } from "@playwright/test";

async function chooseDong(page: Page) {
  await page.getByLabel("기회 동 검색").fill("청운효자동");
  await page
    .locator(".decision-details")
    .filter({ hasText: "조건에 맞는" })
    .locator("summary")
    .click();
  await page.getByRole("button", { name: "청운효자동", exact: true }).click();
  await expect(page.locator(".opportunity-detail h3")).toContainText(
    "청운효자동",
  );
}

test("three focused questions preserve denominators, geography, and withheld values", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "기회 · 적합 · 검증", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "행정동별 존재인구 변화와 영업등록 분포" }),
  ).toBeVisible();
  await expect(page.getByLabel("기회 자치구").locator("option")).toHaveCount(
    26,
  );
  const dashboard = await (await request.get("/data/dashboard.json")).json();
  await expect(page.locator(".lens-heading .decision-badge")).toContainText(
    new RegExp(`\\d+ / ${dashboard.rows.length}동`),
  );
  await page.getByRole("button", { name: "전체 범위", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "전체 범위", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await chooseDong(page);
  await page
    .getByRole("button", { name: "비교함에 추가", exact: true })
    .click();
  await expect(page.locator(".decision-next")).toContainText("1/4");
  await page.getByRole("button", { name: "적합 보기", exact: true }).click();
  await expect(page.locator(".fit-scope-note")).toContainText("청운효자동");
  await expect(page.locator(".fit-scope-note")).toContainText(
    "동네별로 필터링되지 않습니다",
  );
  await expect(page.locator(".fit-cohorts")).toContainText("N=746");
  await expect(page.locator(".fit-cohorts")).toContainText("N=647");
  await expect(page.locator(".fit-cohorts")).toContainText("N=640");
  await expect(page.locator(".fit-row")).toHaveCount(5);
  await page.getByRole("button", { name: /^2인, 가중 구성비/ }).click();
  await expect(page.locator(".fit-detail h3")).toContainText("2인");
  await page.getByRole("button", { name: "검증 보기", exact: true }).click();
  await expect(page.locator(".revenue-lens-empty")).toBeVisible();
  await expect(page.locator(".revenue-lens-empty")).toContainText(
    "0원이 아닙니다",
  );
  await expect(page.locator(".revenue-lens .chart")).toHaveCount(0);
  await expect(page.locator(".revenue-lens-evidence")).toContainText(
    "면적 ↔ 매출: 미연결",
  );
  await expect(
    page.getByRole("heading", { name: "월세 계약 비교" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("linked bedroom revenue stays local and uses one month and exact listing IDs", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "기회 · 적합 · 검증", exact: true }),
  ).toBeVisible();
  await chooseDong(page);
  await page.getByRole("button", { name: "검증 보기", exact: true }).click();
  const dashboard = await (await request.get("/data/dashboard.json")).json();
  const code = dashboard.rows.find(
    (r: any) => r.admin_name === "청운효자동",
  ).admin_code;
  const otherCode = dashboard.rows.find(
    (r: any) => r.admin_code !== code,
  ).admin_code;
  const fixture = {
    schemaVersion: "amo-overlay/1",
    meta: {
      id: "synthetic-bedrooms-e2e",
      title: "E2E synthetic bedroom linkage",
      provider: "synthetic-only",
      observedAt: "2026-11-17",
      geography: "Synthetic Seoul",
      metricDefinition: "Synthetic monthly values, not actual settlement",
      occupancyUnit: "percent",
      currency: "KRW",
    },
    marketMonthly: [],
    warnings: [],
    listings: [
      {
        listingId: "a",
        name: "Synthetic A",
        marketId: "m",
        adminCode: code,
        bedrooms: 1,
        guests: 2,
        latitude: null,
        longitude: null,
      },
      {
        listingId: "b",
        name: "Synthetic B",
        marketId: "m",
        adminCode: code,
        bedrooms: 1,
        guests: 2,
        latitude: null,
        longitude: null,
      },
      {
        listingId: "c",
        name: "Synthetic C",
        marketId: "m",
        adminCode: otherCode,
        bedrooms: 1,
        guests: 2,
        latitude: null,
        longitude: null,
      },
      {
        listingId: "d",
        name: "Synthetic D",
        marketId: "m",
        adminCode: code,
        bedrooms: null,
        guests: 2,
        latitude: null,
        longitude: null,
      },
    ],
    listingMonthly: [
      {
        listingId: "a",
        month: "2026-01",
        revenue: 0,
        adr: null,
        occupancy: null,
        bookedNights: null,
        availableNights: null,
      },
      {
        listingId: "b",
        month: "2026-01",
        revenue: 300,
        adr: null,
        occupancy: null,
        bookedNights: null,
        availableNights: null,
      },
      {
        listingId: "c",
        month: "2026-01",
        revenue: 900,
        adr: null,
        occupancy: null,
        bookedNights: null,
        availableNights: null,
      },
      {
        listingId: "d",
        month: "2026-01",
        revenue: 100,
        adr: null,
        occupancy: null,
        bookedNights: null,
        availableNights: null,
      },
      {
        listingId: "a",
        month: "2026-02",
        revenue: 9000000,
        adr: null,
        occupancy: null,
        bookedNights: null,
        availableNights: null,
      },
    ],
  };
  const writes: string[] = [];
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url());
  });
  await page.getByLabel("연결할 파일").setInputFiles({
    name: "synthetic-bedroom-linkage.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(
    page.getByRole("heading", { name: "기회 · 적합 · 검증", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".local-banner")).toBeVisible();
  await page.getByLabel("비교 월").selectOption("2026-01");
  await expect(page.locator(".revenue-lens-context")).toContainText(
    "KRW/월 · 관측 고유 숙소 3개",
  );
  await expect(page.locator(".revenue-lens-table tbody tr")).toHaveCount(1);
  await expect(
    page.locator(".revenue-lens-table tbody tr").first(),
  ).toContainText("400");
  await expect(
    page.locator(".revenue-lens-table tbody tr").first(),
  ).toContainText("300");
  await expect(page.locator(".revenue-lens-omissions")).toContainText(
    "침실 결측·오류 1",
  );
  await page.getByLabel(/선택 행정동만/).check();
  await expect(page.locator(".revenue-lens-context")).toContainText(
    "관측 고유 숙소 2개",
  );
  await expect(
    page.locator(".revenue-lens-table tbody tr").first(),
  ).toContainText("150");
  await expect(page.locator(".revenue-lens-evidence")).toContainText(
    `코드 ${code} 정확 일치 숙소만 연결`,
  );
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.reload();
  await expect(page.locator(".local-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "검증 보기", exact: true }).click();
  await expect(page.locator(".revenue-lens-empty")).toBeVisible();
});

test("mobile decision lenses stay within the document and keep navigation reachable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "기회 · 적합 · 검증", exact: true }),
  ).toBeVisible();
  for (const label of ["기회 보기", "적합 보기", "검증 보기"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 1000));
    await expect(
      page.getByRole("navigation", { name: "주요 탐색" }),
    ).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.getByRole("button", { name: "적합 보기", exact: true }).click();
  await page.getByRole("button", { name: /^5~6인, 가중 구성비/ }).click();
  await expect(page.locator(".fit-detail h3")).toContainText("5~6인");
  await page.screenshot({
    path: "test-results/decision-fit-mobile.png",
    fullPage: false,
  });
  expect(errors).toEqual([]);
});
