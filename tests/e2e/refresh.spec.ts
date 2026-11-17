import { test, expect } from "@playwright/test";

test("uses a supplied automation payload rather than fixed legacy opportunity fields", async ({
  page,
  request,
}) => {
  const dashboard = await (await request.get("/data/dashboard.json")).json();
  const extensions = await (await request.get("/data/extensions.json")).json();
  const [a, b, c] = dashboard.rows;
  const automation = {
    schemaVersion: "1.0",
    checkedAt: "2028-01-07T21:17:00.000Z",
    status: "success",
    schedule: "매주 월요일 06:17 KST",
    presence: {
      latestMonth: "2027-12",
      comparison: {
        currentYear: 2027,
        previousYear: 2026,
        endMonth: 12,
        periodLabel: "2026·2027년 1~12월",
        currentLabel: "2027년 1~12월 04시",
        method: "full-calendar-day monthly weighted means",
      },
      rows: [
        {
          adminCode: String(a.admin_code),
          meanCurrent04: 17.25,
          meanPrevious04: 12.25,
          changePercent04: 40.82,
          comparisonComplete: true,
          currentDays04: 365,
          previousDays04: 365,
        },
        {
          adminCode: String(b.admin_code),
          meanCurrent04: 0,
          meanPrevious04: 3,
          changePercent04: -100,
          comparisonComplete: true,
          currentDays04: 365,
          previousDays04: 365,
        },
        {
          adminCode: String(c.admin_code),
          meanCurrent04: 15,
          meanPrevious04: 10,
          changePercent04: 50,
          comparisonComplete: false,
          currentDays04: 365,
          previousDays04: 365,
        },
      ],
    },
    registry: {
      observedAt: "2028-01-07T20:00:00.000Z",
      boundaryVintage: "2027-10-01",
      sources: ["synthetic-registry"],
      rows: [
        {
          adminCode: String(a.admin_code),
          foreigner: 9,
          hanok: 0,
          tourist: 0,
          lodging: 0,
        },
        {
          adminCode: String(b.admin_code),
          foreigner: 0,
          hanok: 0,
          tourist: 0,
          lodging: 0,
        },
        {
          adminCode: String(c.admin_code),
          foreigner: 2,
          hanok: 0,
          tourist: 0,
          lodging: 0,
        },
      ],
    },
    sources: [
      {
        id: "presence",
        title: "Synthetic presence",
        status: "automated",
        url: "https://example.test/presence",
        sourcePeriod: "2027-01..12",
        sourceUpdatedAt: "2028-01-07T20:00:00.000Z",
      },
    ],
  };
  await page.route("**/data/extensions.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...extensions, automation }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "비교 기준" }),
  ).toBeVisible();
  await expect(page.locator(".lens-heading .decision-badge")).toContainText(
    `2 / ${dashboard.rows.length}동`,
  );
  await expect(page.locator(".live-updates")).toContainText("마지막 갱신 확인");
  await expect(page.locator(".live-updates")).toContainText(
    "2026·2027년 1~12월",
  );
  await expect(
    page.locator(".opportunity-plot .decision-note").first(),
  ).toContainText("2026·2027년 1~12월");
  await page.getByLabel("기회 동 검색").fill(a.admin_name);
  await expect(
    page
      .locator(".decision-details summary")
      .filter({ hasText: "조건에 맞는" }),
  ).toContainText("1동");
  // A legacy private file may lack automation or carry an untrusted replacement.
  for (const localExtensions of [
    Object.fromEntries(
      Object.entries(extensions).filter(([key]) => key !== "automation"),
    ),
    { ...extensions, automation: { status: "untrusted-private-fixture" } },
  ]) {
    await page.getByLabel("연결할 파일").setInputFiles({
      name: "synthetic-legacy-without-official-authority.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ dashboard, extensions: localExtensions }),
      ),
    });
    await expect(page.getByRole("status")).toContainText("파일 연결됨");
    await expect(page.locator(".live-updates")).toContainText(
      "2026·2027년 1~12월",
    );
    await expect(page.locator(".lens-heading .decision-badge")).toContainText(
      `2 / ${dashboard.rows.length}동`,
    );
    await page
      .getByRole("button", { name: "연결 해제", exact: true })
      .click();
  }
});
