import { expect, test, type Locator, type Page } from "@playwright/test";

const ihwaCode = "11110640";
const ihwaRoute = (view: string, lens?: string) =>
  `/#view=${view}&dong=${ihwaCode}${lens ? `&lens=${lens}` : ""}`;

function sectionForHeading(page: Page, name: string | RegExp): Locator {
  return page
    .getByRole("heading", { name })
    .locator("xpath=ancestor::section[1]");
}

test("A evidence keeps Ihwa's 04시 series when switching night readings and separates the national 24-month context", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(ihwaRoute("trends"));
  const localTrend = sectionForHeading(page, "외국인 존재인구의 흐름");
  await expect(localTrend).toBeVisible();
  await page.getByLabel("추세 기간").selectOption("24");
  await expect(localTrend).toContainText("관측 기간 24개월");

  await page.getByRole("button", { name: "야간 00~06시", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "야간 00~06시", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("요일 구분")).toBeDisabled();

  await page.getByRole("button", { name: "04시", exact: true }).click();
  await expect(page.getByRole("button", { name: "04시", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("요일 구분")).toBeEnabled();
  await localTrend.getByText("월별 수치와 관측 범위 확인", { exact: true }).click();
  const months=await (await page.request.get('/data/observatory.json')).json();
  const row04=months.presence.rows.filter((r:{adminCode:string;month:string;mean04:number|null;days04:number})=>r.adminCode===ihwaCode && months.presence.months.slice(-24).includes(r.month) && r.mean04!==null && r.days04===new Date(Date.UTC(+r.month.slice(0,4),+r.month.slice(5),0)).getUTCDate()).at(-1);
  expect(row04).toBeTruthy();
  await expect(localTrend.getByRole('row').filter({hasText:row04.month})).toContainText(new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(row04.mean04)+'명');

  const national = sectionForHeading(page, "한국에 입국한 외래관광객");
  await expect(national).toBeVisible();
  await expect(national).toContainText("대한민국 전체 · 월간 입국 인원(명) · 지역 선택과 무관");
  await expect(national).toContainText("24개월");
  await expect(national).toContainText("이화동 등 특정 지역의 변화 원인을 설명하지 않습니다");

  await national.getByText('전국 월별 원값 표 (24개월)',{exact:true}).click();
  await expect(national.getByRole('row').filter({hasText:'2026-03'})).toContainText('2,045,992');
  expect(errors).toEqual([]);
});

test("B evidence reports a single registry snapshot without inventing a trend and holds unavailable customer, spatial, and POI claims", async ({
  page,
  request,
}) => {
  const history = (await (
    await request.get("/strategy/v1/registry-history.json")
  ).json()) as { series?: { registry?: { entries?: unknown[] } } };
  const registryEntries = history.series?.registry?.entries ?? [];

  await page.goto(ihwaRoute("supply"));

  const registryHistory = page.getByRole("region", { name: "선택 행정동 관측 이력" });
  await expect(registryHistory).toBeVisible();
  if (registryEntries.length === 1) {
    await expect(registryHistory).toContainText("두 번째 관측 기간이 없어 증감을 표시하지 않습니다.");
    await expect(registryHistory).not.toContainText("직전 기간 대비");
  } else {
    await expect(registryHistory).toContainText("실제 관측한 인접 기간만 비교합니다.");
  }

  const tourism = page.getByRole("region", { name: "관광숙박 특화구역" });
  await expect(tourism).toBeVisible();
  await expect(tourism).toContainText(/63곳.*기본 9곳.*한시 54곳.*행정동 확인 24곳/);
  await expect(tourism).toContainText('대표지번 26개 · 22개 행정동');
  await expect(tourism).toContainText("39곳");
  await expect(tourism).toContainText("미확인은 비지정이 아니");

  await page
    .getByText("건물 용도와 용도지역은 어디까지 확인했나요?", { exact: true })
    .click();
  const spatial = sectionForHeading(page, "건물 용도와 용도지역");
  await expect(spatial).toContainText("공개 수치 없음");
  await expect(spatial).toContainText("빈 값은 0%나 허용지역을 뜻하지 않습니다");

  await page.goto(ihwaRoute("people"));
  const nationality = sectionForHeading(page, "이 동의 숙박 고객은 어느 국적인가요?");
  await expect(nationality).toContainText("공개권한 확인 대기");
  await expect(nationality).toContainText("미제공 값을 0명으로 바꾸지 않습니다");
  await expect(nationality.getByRole("table")).toHaveCount(0);

  await page.goto(ihwaRoute('trends'));
  const context=page.getByRole('region',{name:'선택 행정동 관측 이력'});
  await expect(context).toContainText('여관 분기 카드추정매출');
  await expect(context).toContainText('공식 파일 수동 확인 (주간 수집 제외)');
  await expect(context).toContainText('이동·매출·점포 관측 이력');
  await page.goto(ihwaRoute("decision", "fit"));
  const poi = page.getByRole("region", { name: "생활편의 시설과 역 접근성" });
  const osm=await (await request.get('/strategy/v1/osm-status.json')).json();
  if(osm.status==='unavailable'){
    await expect(poi).toContainText('검증된 서울 OSM 분기 스냅샷 미제공');
    await expect(poi).toContainText('시설이 없다는 뜻이 아닙니다');
    await expect(poi.getByRole('table')).toHaveCount(0);
  } else await expect(poi).toContainText('지도에 입력된 시설만');
});

test("held A3 and A4 evidence stays explicit on a narrow integrated screen without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(ihwaRoute("map"));
  await page
    .getByText("지하철 심야 하차를 표시하지 않는 이유", { exact: true })
    .click();
  await expect(page.getByText("22~02시 합계는 미확인이지 0명이 아닙니다.")).toBeVisible();

  await page.goto(ihwaRoute("compare"));
  const land = sectionForHeading(page, "진입 비용 배경: 개별공시지가");
  await expect(land).toContainText("동별 지가 미제공.");
  await expect(land).toContainText("같은 필지번호의 경계 원본으로 공간결합을 검증하기 전에는 값을 표시하지 않습니다.");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});

test('official location-only map and readout agree for three dongs without ridership, route or provider calls', async ({page})=>{
  const before:string[]=[];page.on('request',req=>{if(/overpass|apis\.data\.go\.kr|api\.vworld\.kr/.test(req.url()))before.push(req.url());});
  for(const [code,name,metres] of [['11110640','혜화(4호선)','214'],['11440660','홍대입구(2호선)','192'],['11560540','여의나루(5호선)','301']]){
    await page.goto('/#view=map&dong='+code);
    const station=page.getByTestId('official-station-readout');
    await expect(station).toContainText(name); await expect(station).toContainText(metres+' m');
    const toggle=page.getByRole('button',{name:/교통공사 역 위치/});
    if(await toggle.getAttribute('aria-pressed')!=='true')await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed','true');
    await expect(page.getByTestId('official-station-map-pane')).toBeAttached();
    await expect(station).toContainText('걷는 거리·시간이 아닙니다');
  }
  expect(before).toEqual([]);
});
