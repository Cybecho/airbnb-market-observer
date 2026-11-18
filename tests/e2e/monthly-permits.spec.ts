import { test, expect, type Page } from "@playwright/test";

type PermitCell = [number | null, number | null, number | null, number | null];
type Category = { id: string; label: string };
type Area = {
  level: "city" | "gu" | "dong";
  label: string;
  gu: string;
  series: Record<string, PermitCell[]>;
};
type MonthlySnapshot = {
  schema: string;
  months: string[];
  categories: Category[];
  areas: Record<string, Area>;
  held: { label: string; reason: string }[];
};

type LocatedCell = {
  category: Category;
  areaKey: string;
  area: Area;
  month: string;
  index: number;
  cell: PermitCell;
};

async function monthlySnapshot(page: Page): Promise<MonthlySnapshot> {
  const response = await page.request.get("/supply/v1/monthly.json");
  expect(response.ok()).toBe(true);
  const snapshot = (await response.json()) as MonthlySnapshot;
  expect(snapshot.schema).toBe("amo-monthly-permits/1");
  expect(snapshot.months).toHaveLength(24);
  expect(snapshot.areas.SEOUL).toBeDefined();
  expect(snapshot.areas["구:종로구"]).toBeDefined();
  expect(snapshot.areas["11110640"]).toBeDefined();
  expect(snapshot.categories.length).toBeGreaterThan(0);
  return snapshot;
}

function firstCell(
  snapshot: MonthlySnapshot,
  predicate: (cell: PermitCell) => boolean,
  levels: Area["level"][] = ["city", "gu", "dong"],
): LocatedCell {
  for (const category of snapshot.categories) {
    for (const [areaKey, area] of Object.entries(snapshot.areas)) {
      if (!levels.includes(area.level)) continue;
      const series = area.series[category.id];
      const index = series?.findIndex(predicate) ?? -1;
      if (index >= 0) {
        return {
          category,
          areaKey,
          area,
          month: snapshot.months[index],
          index,
          cell: series[index],
        };
      }
    }
  }
  throw new Error("The monthly snapshot has no cell matching the E2E condition");
}

function sourceRow(page: Page, value: LocatedCell) {
  return page
    .getByRole("table", { name: "월별 인허가 원자료" })
    .locator(
      `tbody tr[data-month="${value.month}"][data-area="${value.areaKey}"][data-category="${value.category.id}"]`,
    );
}

async function openRawTable(page: Page) {
  await page.getByText("월별 원자료 보기", { exact: true }).click();
  await expect(
    page.getByRole("table", { name: "월별 인허가 원자료" }),
  ).toBeVisible();
}

const formattedCount = (value: number | null) =>
  new Intl.NumberFormat("ko-KR").format(value ?? 0);

async function chooseScope(page: Page, value: LocatedCell) {
  const gu = page.getByLabel("월별 인허가 지역 범위");
  const dong = page.getByLabel("월별 인허가 행정동");
  if (value.area.level === "city") {
    await gu.selectOption("");
    return;
  }
  await gu.selectOption(value.area.gu);
  if (value.area.level === "dong") await dong.selectOption(value.areaKey);
}

test("monthly permits is available from the default decision core and uses the published snapshot", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "기회 · 적합 · 검증", exact: true }),
  ).toBeVisible();

  const snapshot = await monthlySnapshot(page);
  await expect(
    page.getByRole("heading", { name: "월별 숙박 인허가 추세", exact: true }),
  ).toBeVisible();
  await page.goto("/#view=supply");
  await expect(
    page.getByRole("heading", { name: "월별 숙박 인허가 추세", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "월별 숙박 인허가 추세" }),
  ).toBeVisible();
  await expect(page.getByLabel("월별 인허가 지역 범위")).toHaveValue("");
  await expect(page.getByLabel("월별 인허가 행정동")).toHaveValue("");
  await expect(page.getByLabel("월별 인허가 업종")).toHaveValue(
    (snapshot.categories.find((category) => category.id === "foreigner") ??
      snapshot.categories[0]).id,
  );
  await expect(
    page.getByRole("img", { name: /월별 .*폐업률/ }),
  ).toBeVisible();
  await expect(
    page.getByText("월별 원자료 보기", { exact: true }),
  ).toBeVisible();
  await openRawTable(page);
  await expect(
    page.getByRole("table", { name: "최근 완료월 업종 비교" }),
  ).toBeVisible();
});

test("monthly permits keeps Seoul as a reset baseline and changes scope and category", async ({
  page,
}) => {
  const snapshot = await monthlySnapshot(page);
  const nonzeroDong = firstCell(
    snapshot,
    ([opened, closed]) => (opened ?? 0) > 0 || (closed ?? 0) > 0,
    ["dong"],
  );
  const foreignerOrHostel = snapshot.categories.find((category) =>
    /외국인|호스텔/.test(category.label),
  );

  await page.goto("/#view=supply");
  await expect(
    page.getByRole("heading", { name: "월별 숙박 인허가 추세", exact: true }),
  ).toBeVisible();
  await openRawTable(page);
  await page.getByLabel("월별 인허가 업종").selectOption(nonzeroDong.category.id);
  await chooseScope(page, nonzeroDong);
  await expect(page.getByLabel("월별 인허가 지역 범위")).toHaveValue(
    nonzeroDong.area.gu,
  );
  await expect(page.getByLabel("월별 인허가 행정동")).toHaveValue(
    nonzeroDong.areaKey,
  );
  await expect(sourceRow(page, nonzeroDong)).toContainText(nonzeroDong.month);
  await expect(sourceRow(page, nonzeroDong)).toContainText(
    formattedCount(nonzeroDong.cell[0] ?? nonzeroDong.cell[1]),
  );

  if (foreignerOrHostel) {
    await page.getByLabel("월별 인허가 업종").selectOption(foreignerOrHostel.id);
    await expect(
      page.getByRole("img", {
        name: new RegExp(`월별 .*폐업률.*${foreignerOrHostel.label}`),
      }),
    ).toBeVisible();
  }

  const comparisonCategory = foreignerOrHostel ?? snapshot.categories[0];
  const comparisonButton = page.getByRole("button", {
    name: `${comparisonCategory.label} 추세 보기`,
    exact: true,
  });
  await comparisonButton.focus();
  await expect(comparisonButton).toBeFocused();
  await comparisonButton.press("Enter");
  await expect(page.getByLabel("월별 인허가 업종")).toHaveValue(
    comparisonCategory.id,
  );

  await page.getByRole("button", { name: "서울 전체로 초기화", exact: true }).click();
  await expect(page.getByLabel("월별 인허가 지역 범위")).toHaveValue("");
  await expect(page.getByLabel("월별 인허가 행정동")).toHaveValue("");
  await expect(
    page.getByRole("img", { name: /월별 .*폐업률.*서울 전체/ }),
  ).toBeVisible();
});

test("monthly permits keeps true values and leaves zero denominators unreported", async ({
  page,
}) => {
  const snapshot = await monthlySnapshot(page);
  const nonzero = firstCell(
    snapshot,
    ([opened, closed]) => (opened ?? 0) > 0 || (closed ?? 0) > 0,
  );
  const noDenominator = firstCell(
    snapshot,
    ([, , start, closedFromStart]) =>
      (start === 0 || start === null) && closedFromStart !== null,
  );

  await page.goto("/#view=supply");
  await openRawTable(page);
  await page.getByLabel("월별 인허가 업종").selectOption(nonzero.category.id);
  await chooseScope(page, nonzero);
  const nonzeroRow = sourceRow(page, nonzero);
  await expect(nonzeroRow).toBeVisible();
  await expect(nonzeroRow).toContainText(
    formattedCount(nonzero.cell[0] ?? nonzero.cell[1]),
  );

  await page.getByLabel("월별 인허가 업종").selectOption(noDenominator.category.id);
  await chooseScope(page, noDenominator);
  const nullRateCell = sourceRow(page, noDenominator).locator("td").last();
  await expect(nullRateCell).not.toHaveText(/0\s*%/);
  await expect(nullRateCell).toHaveText(/산출 불가|—|미산출|해당 없음|N\/A/);
});

test("map region interaction reaches monthly permits without mobile page overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#view=map");
  const jongnoCheongun = page.locator(
    '.seoul-map path[data-area-code="11110640"]',
  );
  await expect(jongnoCheongun).toBeAttached();
  await jongnoCheongun.dispatchEvent("click");
  await expect.poll(() => page.evaluate(() => location.hash)).toContain(
    "dong=11110640",
  );

  await expect(page.getByLabel("월별 인허가 행정동")).toHaveValue("11110640");
  await page.locator(".nav-more > summary").click();
  await page.getByRole("button", { name: "등록 공급", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "월별 숙박 인허가 추세", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("월별 인허가 행정동")).toHaveValue("11110640");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('shared hostel trends, complete-month controls and openings-only lodging survive navigation', async ({page})=>{
  const snapshot=await monthlySnapshot(page);
  await page.goto('/#view=supply&dong=11440660&permit=hostel');
  await expect(page.getByLabel('월별 인허가 업종')).toHaveValue('hostel');
  await expect(page.getByLabel('월별 인허가 지역 범위')).toHaveValue('마포구');
  const net=page.getByRole('img',{name:'월별 순증감과 폐업률: 마포구 서교동 · 호스텔업',exact:true});await expect(net).toBeVisible();
  await page.getByLabel('월별 인허가 건수 지표').selectOption('flows');
  await expect(page.getByRole('img',{name:/신규·폐업.*서교동.*호스텔업/})).toBeVisible();
  await page.getByLabel('월별 인허가 건수 지표').selectOption('stock');
  await expect(page.getByRole('img',{name:/월초 등록.*서교동.*호스텔업/})).toBeVisible();
  await page.getByLabel('월별 인허가 표시 기간').selectOption('12');
  await openRawTable(page);
  const table=page.getByRole('table',{name:'월별 인허가 원자료'});
  await expect(table.locator('tbody tr')).toHaveCount(24);
  const index=snapshot.months.length-1;
  for(const id of ['11440660','SEOUL']){
    const cells=table.locator(`tbody tr[data-month="${snapshot.months[index]}"][data-category="hostel"][data-area="${id}"] td`);
    const expected=snapshot.areas[id].series.hostel[index];
    for(const [sourceSlot,displayColumn] of [[0,1],[1,2],[2,5],[3,4]]) await expect(cells.nth(displayColumn)).toHaveText(expected[sourceSlot]===null?'미제공':new Intl.NumberFormat('ko-KR').format(expected[sourceSlot]!));
  }
  await page.getByLabel('월별 인허가 업종').selectOption('general');
  await expect(page.getByRole('img',{name:/월별 신규 인허가.*서교동.*일반숙박업/})).toBeVisible();
  await expect(page.getByText(/이 원천에는 확인된 폐업일이 없습니다/)).toBeVisible();
  await expect(table.locator('tbody tr').last().locator('td').last()).toHaveText('미산출');
});
