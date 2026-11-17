import { expect, test, type Page } from "@playwright/test";

test.use({ hasTouch: true });

const monthlyChart = (page: Page) =>
  page.locator('.trend-card canvas[role="img"]');
const chartGuide = (page: Page) => page.locator(".trend-card .atlas-info");
const monthlyTable = (page: Page) =>
  page.locator(".trend-card > details .data-table");

async function openMonthlyTable(page: Page) {
  const details = page.locator(".trend-card > details");
  if ((await details.getAttribute("open")) === null) {
    await details.locator("summary").click();
  }
  await expect(monthlyTable(page)).toBeVisible();
}

async function monthlyDescription(page: Page) {
  const id = await monthlyChart(page).getAttribute("aria-describedby");
  if (!id) throw new Error("The monthly chart must describe itself.");
  return page.locator(`[id="${id}"]`);
}

test("monthly chart guide supports hover, keyboard, touch toggle, dismissal, and a narrow layout", async ({
  page,
}) => {
  await page.goto("/#view=trends");
  await expect(monthlyChart(page)).toBeVisible();

  const guide = chartGuide(page);
  const tooltip = page.getByRole("tooltip");
  await guide.hover();
  await expect(tooltip).toBeVisible();
  await expect(guide).toHaveAttribute("aria-expanded", "true");

  await page.locator(".trend-card .chart-controls select").last().focus();
  await page.keyboard.press("Tab");
  await expect(guide).toBeFocused();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();

  const outside = page.locator(".trend-card .section-heading");
  await guide.click();
  await expect(tooltip).toBeVisible();
  await outside.hover();
  await expect(tooltip).toBeVisible();
  await guide.click();
  await outside.hover();
  await expect(tooltip).toBeHidden();

  const box = await guide.boundingBox();
  expect(box).not.toBeNull();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(tooltip).toBeVisible();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(tooltip).toBeHidden();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(tooltip).toBeVisible();
  await outside.click();
  await expect(tooltip).toBeHidden();

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(monthlyChart(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});

test("official observatory sentinels survive a local legacy import without persistence or requests", async ({
  page,
  request,
}) => {
  const dashboard = await (await request.get("/data/dashboard.json")).json();
  const extensions = await (await request.get("/data/extensions.json")).json();
  const selected = dashboard.rows[0];
  const days = (month: string) =>
    new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const months = ["2026-01", "2026-02", "2026-03"];
  const officialObservatory = {
    schemaVersion: "synthetic-observatory/1",
    updatedAt: "2026-03-31T00:00:00.000Z",
    sources: [
      {
        id: "official-synthetic-sentinel",
        title: "Official synthetic observatory sentinel",
        url: "https://example.test/official-observatory",
        period: months.join(".."),
        unit: "people",
        definition: "Synthetic test data only.",
      },
    ],
    presence: {
      months,
      rows: [
        {
          month: "2026-01",
          adminCode: String(selected.admin_code),
          gu: selected.gu,
          name: "E2E sentinel selected dong",
          mean04: 0,
          mean14: 1,
          weekday04: 0,
          weekend04: 0,
          weekday14: 1,
          weekend14: 1,
          days04: days("2026-01"),
          days14: days("2026-01"),
        },
        {
          month: "2026-02",
          adminCode: String(selected.admin_code),
          gu: selected.gu,
          name: "E2E sentinel selected dong",
          mean04: null,
          mean14: null,
          weekday04: null,
          weekend04: null,
          weekday14: null,
          weekend14: null,
          days04: days("2026-02"),
          days14: days("2026-02"),
        },
        {
          month: "2026-03",
          adminCode: String(selected.admin_code),
          gu: selected.gu,
          name: "E2E sentinel selected dong",
          mean04: 17,
          mean14: 17,
          weekday04: 17,
          weekend04: 17,
          weekday14: 17,
          weekend14: 17,
          days04: days("2026-03") - 1,
          days14: days("2026-03") - 1,
        },
      ],
    },
  };
  await page.route("**/data/observatory.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(officialObservatory),
    }),
  );

  const importRequests: Array<{ method: string; url: string }> = [];
  let importing = false;
  page.on("request", (entry) => {
    if (importing) importRequests.push({ method: entry.method(), url: entry.url() });
  });

  await page.goto(`/#view=trends&dong=${selected.admin_code}`);
  await expect(monthlyChart(page)).toBeVisible();
  await openMonthlyTable(page);
  await expect(monthlyTable(page)).toContainText("2026-01");
  await expect(monthlyTable(page)).toContainText("0명");
  const incompleteMarch = monthlyTable(page)
    .locator("tbody tr")
    .filter({ hasText: "2026-03" });
  await expect(incompleteMarch).toContainText("미제공");
  await expect(incompleteMarch).not.toContainText("0명");
  const officialTable = await monthlyTable(page).innerText();
  const officialDescription = await (await monthlyDescription(page)).innerText();
  expect(officialTable).toContain("2026-01");
  expect(officialTable).toContain("0명");
  expect(officialTable).toContain("미제공");

  const legacyFixture = {
    dashboard: {
      ...dashboard,
      rows: dashboard.rows.map((row: Record<string, unknown>) => ({ ...row })),
    },
    extensions: {
      ...extensions,
      automation: { invalidReplacement: true },
      observatory: { invalidReplacement: true },
    },
    observatory: { invalidReplacement: true },
  };
  importing = true;
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic-legacy-observatory-sentinel.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacyFixture)),
  });
  await expect(page.locator(".local-banner")).toBeVisible();
  importing = false;

  await expect(monthlyChart(page)).toBeVisible();
  await expect(monthlyTable(page)).toHaveText(officialTable);
  await expect(await monthlyDescription(page)).toHaveText(officialDescription);
  await expect(monthlyTable(page)).toContainText("0명");
  await expect(monthlyTable(page)).toContainText("미제공");
  expect(importRequests).toEqual([]);
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });

  await page.reload();
  await expect(page.locator(".local-banner")).toHaveCount(0);
  await expect(monthlyChart(page)).toBeVisible();
  await openMonthlyTable(page);
  await expect(monthlyTable(page)).toHaveText(officialTable);
});
