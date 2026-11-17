import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type {
  ResearchArea,
  ResearchIndex,
  ResearchTier,
} from "../../src/researchTypes";

const tiers: ResearchTier[] = ["field", "peer", "watch", "insufficient"];
const indexPath = "/research/v1/index.json";
const contractPath = "/research/v1/contract.json";
const monthlyFeedPath = "/data/observatory.json";
const evidenceRules = {
  previous04: "base",
  current04: "level",
  delta04: "gain",
  registrations: "lowRegistration",
} as const;

async function publicJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const response = await request.get(url);
  expect(response.ok(), `${url} should be public`).toBeTruthy();
  return (await response.json()) as T;
}

async function researchIndex(request: APIRequestContext) {
  const index = await publicJson<ResearchIndex>(request, indexPath);
  expect(index.schemaVersion).toBe("amo-research/1");
  expect(index.areas.length).toBe(index.counts.total);
  return index;
}

function areaFor(index: ResearchIndex, tier: ResearchTier, except?: string) {
  return (
    index.areas.find(
      (area) => area.tier === tier && area.code !== except,
    ) ?? index.areas.find((area) => area.code !== except) ?? index.areas[0]
  );
}

function validOverlay(marker: string) {
  return {
    schemaVersion: "amo-overlay/1",
    meta: {
      id: marker,
      title: "Synthetic private research fixture",
      provider: "synthetic-test-only",
      observedAt: "2026-11-17",
      geography: "city",
      metricDefinition: "Synthetic test data only.",
      occupancyUnit: "percent",
      currency: "KRW",
      availableNightsDefinition: "sellable_total",
    },
    marketMonthly: [
      {
        marketId: "synthetic-city",
        marketName: "Synthetic city",
        geography: "city",
        month: "2026-01",
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
}

const whereUrl = (area: ResearchArea) =>
  `/#view=decision&lens=where&dong=${area.code}&gu=${encodeURIComponent(area.gu)}&tier=${area.tier}`;

async function expectSelectedArea(page: Page, area: ResearchArea) {
  const evidence = page.getByTestId("area-evidence");
  await expect(evidence).toHaveAttribute("data-area-code", area.code);
  await expect(evidence).toHaveAttribute("data-tier", area.tier);
  await expect(
    evidence.getByRole("heading", {
      name: `${area.gu} ${area.name}`,
      exact: true,
    }),
  ).toBeVisible();
}

test("publishes the typed research index, data-only contract, and where entry", async ({
  page,
  request,
}) => {
  const [index, contract] = await Promise.all([
    researchIndex(request),
    publicJson<Record<string, unknown>>(request, contractPath),
  ]);
  expect(contract).not.toHaveProperty("areas");
  expect(JSON.stringify(contract)).toMatch(/eligib/i);
  expect(JSON.stringify(contract)).toMatch(/threshold/i);
  expect(Object.keys(index.counts.byTier).sort()).toEqual([...tiers].sort());
  expect(index.areas.every((area) => /^\d{8}$/.test(area.code))).toBe(true);

  await page.goto("/#view=decision");
  await expect(
    page.locator('link[rel="alternate"][type="application/json"]'),
  ).toHaveAttribute("href", "./research/v1/index.json");
  const entry = page.getByRole("link", { name: "어디를, 왜 볼까", exact: true });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page).toHaveURL(/#view=decision&lens=where/);
  await expect(page.getByTestId("research-lens")).toBeVisible();
  await expect(page.getByTestId("research-status")).toBeVisible();
  expect(index.counts.total).toBeGreaterThan(0);
});

test("where lens filters, selects real paths and table links, and preserves deep links", async ({
  page,
  request,
}) => {
  const [index, contract] = await Promise.all([
    researchIndex(request),
    publicJson<Record<string, unknown>>(request, contractPath),
  ]);
  // Contract wording may be nested, but it must document public eligibility and thresholds.
  expect(JSON.stringify(contract)).toMatch(/eligib/i);
  expect(JSON.stringify(contract)).toMatch(/threshold/i);
  const mapOrigin = areaFor(index, "field");
  const mapTarget = areaFor(index, mapOrigin.tier, mapOrigin.code);
  const tableTarget = areaFor(index, mapTarget.tier, mapTarget.code);
  const mobileTarget = areaFor(index, "watch", tableTarget.code);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(whereUrl(mapOrigin));
  await expect(page.getByTestId("research-lens")).toBeVisible();
  await expectSelectedArea(page, mapOrigin);
  await page.getByRole("combobox", { name: "조사 자치구", exact: true }).selectOption("");
  await page.getByRole("combobox", { name: "조사 분류", exact: true }).selectOption(mapTarget.tier);
  const map = page.getByTestId("research-map");
  const path = map.locator(
    `path[data-area-code="${mapTarget.code}"][data-tier="${mapTarget.tier}"]`,
  );
  await expect(path).toBeVisible();
  await path.focus();
  await page.keyboard.press("Enter");
  await expect(path).toHaveAttribute("aria-pressed", "true");
  await expectSelectedArea(page, mapTarget);
  await expect(page).toHaveURL(new RegExp(`dong=${mapTarget.code}`));
  await expect(page.getByTestId("research-status")).toContainText(
    String(index.counts.byTier[mapTarget.tier]),
  );
  await expect(
    map.locator(`path[data-tier="${mapTarget.tier}"][aria-disabled="false"]`),
  ).toHaveCount(index.counts.byTier[mapTarget.tier]);

  await page.getByRole("searchbox", { name: "조사 동 검색", exact: true }).fill(tableTarget.code);
  const table = page.getByTestId("research-table");
  const tableLink = table.locator(
    `a[data-area-code="${tableTarget.code}"][href*="dong=${tableTarget.code}"]`,
  );
  await expect(tableLink).toBeVisible();
  await tableLink.click();
  await expectSelectedArea(page, tableTarget);
  await page.goBack();
  await expectSelectedArea(page, mapTarget);
  await page.goForward();
  await expectSelectedArea(page, tableTarget);

  await page.reload();
  await expectSelectedArea(page, tableTarget);
  for (const name of ["기회 보기", "적합 보기", "검증 보기"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "기회 보기", exact: true }).click();
  await expect(page).toHaveURL(/lens=opportunity/);
  await page.goBack();
  await expectSelectedArea(page, tableTarget);
  await page.goForward();
  await expect(page).toHaveURL(/lens=opportunity/);

  const zeroCohort = index.areas
    .map((area) => ({
      area,
      key: (Object.keys(evidenceRules) as Array<keyof typeof evidenceRules>).find(
        (key) => area.eligible && area.values[key] === 0,
      ),
    }))
    .find(({ key }) => key);
  if (zeroCohort) {
    await page.goto(whereUrl(zeroCohort.area));
    await expectSelectedArea(page, zeroCohort.area);
    await expect(
      page
        .getByTestId("area-evidence")
        .locator(`[data-rule="${evidenceRules[zeroCohort.key!]}"]`),
    ).toContainText("0");
  } else {
    expect(index.areas.every((area) => Object.values(area.values).every((value) => value !== 0))).toBe(true);
  }
  const withheld = index.areas.find(
    (area) =>
      !area.eligible &&
      (Object.keys(evidenceRules) as Array<keyof typeof evidenceRules>).some(
        (key) => area.values[key] === null,
      ),
  );
  if (withheld) {
    await page.goto(whereUrl(withheld));
    await expectSelectedArea(page, withheld);
    await expect(page.getByTestId("area-evidence")).toContainText(/미제공|판정 불가/);
  } else {
    expect(index.counts.byTier.insufficient).toBe(0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(whereUrl(mobileTarget));
  await expectSelectedArea(page, mobileTarget);
  const mobileLayout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    boxes: [...document.querySelectorAll('[data-testid="research-lens"] > *,[data-testid="area-evidence"] > *')].filter(el=>el.getBoundingClientRect().right > window.innerWidth + 1).map(el=>[el.className,Math.round(el.getBoundingClientRect().width)]),
  }));
  expect(mobileLayout.document, JSON.stringify(mobileLayout)).toBeLessThanOrEqual(mobileLayout.viewport + 1);
  await expect(page.getByTestId('area-evidence').getByRole('heading',{name:mobileTarget.gu+' '+mobileTarget.name,exact:true})).toBeVisible();
  await page.getByRole("searchbox", { name: "조사 동 검색", exact: true }).fill(mobileTarget.code);
  await page
    .getByTestId("research-table")
    .locator(`a[data-area-code="${mobileTarget.code}"]`)
    .click();
  await expectSelectedArea(page, mobileTarget);
  expect(errors).toEqual([]);
});

test("a synthetic private attachment cannot replace or persist public research data", async ({
  page,
  request,
}) => {
  const index = await researchIndex(request);
  const officialMonthly = await publicJson<Record<string, unknown>>(
    request,
    monthlyFeedPath,
  );
  const area = areaFor(index, "field");
  const privateMarker = "PRIVATE_RESEARCH_E2E_ONLY";
  const requests: Array<{ method: string; url: string }> = [];
  page.on("request", (entry) =>
    requests.push({ method: entry.method(), url: entry.url() }),
  );

  await page.goto(whereUrl(area));
  await expectSelectedArea(page, area);
  const evidence = page.getByTestId("area-evidence");
  const renderedOfficialStats = await evidence.locator(".area-evidence__table").allTextContents();
  const beforeIndexGets = requests.filter(({ url }) => url.includes(indexPath)).length;
  const beforeMonthlyGets = requests.filter(({ url }) => url.includes(monthlyFeedPath)).length;
  expect(beforeIndexGets).toBeGreaterThan(0);
  expect(beforeMonthlyGets).toBeGreaterThan(0);
  await page.getByLabel("연결할 파일").setInputFiles({
    name: "synthetic-private-research-overlay.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(validOverlay(privateMarker))),
  });

  await expect(page.locator(".local-banner")).toBeVisible();
  await expectSelectedArea(page, area);
  expect(await evidence.locator(".area-evidence__table").allTextContents()).toEqual(renderedOfficialStats);
  await expect(page.getByTestId("research-lens")).not.toContainText(privateMarker);
  await expect(evidence).not.toContainText(privateMarker);
  expect(officialMonthly).toHaveProperty("presence");
  expect(JSON.stringify(officialMonthly)).not.toContain(privateMarker);
  expect(requests.filter(({ url }) => url.includes(indexPath))).toHaveLength(
    beforeIndexGets,
  );
  expect(requests.filter(({ url }) => url.includes(monthlyFeedPath))).toHaveLength(
    beforeMonthlyGets,
  );
  expect(requests.filter(({ method }) => !["GET", "HEAD"].includes(method))).toEqual([]);
  expect(await page.url()).not.toContain(privateMarker);
  expect(
    await page.evaluate(() => ({
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
    })),
  ).not.toEqual(expect.objectContaining({ local: expect.stringContaining(privateMarker) }));
  expect(
    await page.evaluate(() => JSON.stringify({ localStorage, sessionStorage })),
  ).not.toContain(privateMarker);
});

test("a missing public index is explicitly recoverable and never falls back to a private file", async ({
  page,
}) => {
  const privateMarker = "PRIVATE_RESEARCH_404_ONLY";
  await page.route("**/research/v1/index.json", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/#view=decision&lens=where");
  const unavailable = page.getByTestId("research-status");
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toContainText(/조사.*(없|실패|불가)|unavailable/i);
  await page.getByLabel("연결할 파일").setInputFiles({
    name: "synthetic-private-fallback-overlay.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(validOverlay(privateMarker))),
  });
  await expect(unavailable).toContainText(/조사.*(없|실패|불가)|unavailable/i);
  await expect(page.getByTestId("area-evidence")).toHaveCount(0);
  expect(await page.url()).not.toContain(privateMarker);
  expect(
    await page.evaluate(() => JSON.stringify({ localStorage, sessionStorage })),
  ).not.toContain(privateMarker);
});
