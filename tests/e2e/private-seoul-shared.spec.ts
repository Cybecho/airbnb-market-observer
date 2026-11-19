import { test, expect, type Page } from '@playwright/test';

// Deliberately fictional, nonconsecutive months, latest first. No data file on disk.
const header = 'month,adr_krw,occ_pct,revpar_krw,source_file,file_number,file_registered';
const csv = [header,
  '208709,713849,23.47,167531,가상 석영,987631,2087-10-03',
  '208707,612743,18.63,114157,가상 호박,987629,2087-08-03',
].join('\r\n');
const file = (text: string) => ({ name: 'imaginary-series.csv', mimeType: 'text/csv', buffer: Buffer.from(text) });
const panel = (page: Page) => page.getByTestId('seoul-shared-monthly');
const input = (page: Page) => page.locator('header').getByLabel('연결할 파일', { exact: true });
const metrics = ['713,849원', '23.47%', '167,531원'];
const privateMarker = /2087-?0[79]|713,?849|23\.47|167,?531|612,?743|18\.63|114,?157|fiction-(quartz|amber)|9876(31|29)|imaginary-series/i;

// Only these existing public snapshots are needed by sources, performance and trends.
// Reject unexpected reads even on first load/reload, before any file has been selected.
const publicReads = new Set([
  '/data/dashboard.json', '/data/extensions.json', '/data/seoul-admin.geojson', '/data/observatory.json',
  '/research/v1/index.json', '/research/v1/gaps.json', '/strategy/v1/station-locations.json',
  '/supply/v1/monthly.json', '/strategy/v1/macro.json', '/strategy/v1/context-history.json',
]);
test.use({ serviceWorkers: 'block' });
async function privacyAudit(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const violations: string[] = [];
  await page.context().route('**/*', async route => {
    const r = route.request(), url = new URL(r.url());
    const isRead = ['fetch', 'xhr'].includes(r.resourceType());
    if (!['GET', 'HEAD'].includes(r.method()) || privateMarker.test(decodeURI(url.href)) ||
        (isRead && (url.origin !== origin || !publicReads.has(url.pathname) || url.search !== ''))) {
      violations.push(`${r.method()} ${url.pathname}`);
      await route.abort();
    } else if (url.origin !== origin) await route.abort(); // Never depend on GitHub or other sites.
    else await route.continue();
  });
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame() && privateMarker.test(decodeURI(frame.url()))) violations.push('private route');
  });
  return async () => {
    expect(violations).toEqual([]);
    expect(decodeURI(page.url())).not.toMatch(privateMarker);
    const state = await page.context().storageState({ indexedDB: true });
    expect(JSON.stringify(state.origins)).not.toMatch(privateMarker);
  };
}

async function expectLatest(page: Page) {
  await expect(panel(page).getByRole('heading', { name: /최근 기준월.*2087-09/ })).toBeVisible();
  await expect(panel(page).locator('dl dd')).toHaveText(metrics);
}
async function expectEmpty(page: Page) {
  await expect(panel(page).getByRole('button', { name: '야놀자 CSV 연결', exact: true })).toBeVisible();
  await expect(panel(page).locator('dd')).toHaveCount(0);
  await expect(panel(page)).not.toContainText(privateMarker);
}
async function checkRaw(page: Page) {
  const table = panel(page).getByRole('table', { name: '서울 공유숙박 월별 원자료' });
  if (!(await table.isVisible())) await panel(page).getByText('월별 원자료 보기', { exact: true }).click();
  await expect(table.getByRole('rowheader')).toHaveText(['2087-07', '2087-09']);
  for (const [month, values] of [
    ['2087-07', ['612,743원', '18.63%', '114,157원']],
    ['2087-09', metrics],
  ] as const) {
    const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: month }) });
    for (const value of values) await expect(row.getByRole('cell', { name: value, exact: true })).toBeVisible();
  }
}

test('CSV import from sources, Seoul-wide trends, rejected replacement and disconnect', async ({ page, baseURL }) => {
  const audit = await privacyAudit(page, baseURL!);
  await page.goto('/#view=sources');
  await expect(input(page)).toHaveAttribute('accept', /json/i);
  await expect(input(page)).toHaveAttribute('accept', /csv/i);
  await input(page).setInputFiles(file(csv));
  await expect(page).toHaveURL(/#view=performance(?:&|$)/);
  await expectLatest(page);
  const controls = panel(page).getByRole('group', { name: '차트 지표' });
  await expect(controls.getByRole('button', { name: 'ADR', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const metric of ['OCC', 'RevPAR', 'ADR']) {
    const choice = controls.getByRole('button', { name: metric, exact: true });
    await choice.click();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page).getByRole('img', { name: new RegExp(`서울 공유숙박 월별 ${metric}`) })).toBeVisible();
  }
  await checkRaw(page);
  await audit();

  await input(page).setInputFiles(file('not,the,expected,header\ninvalid,row,only,here'));
  await expect(page.getByRole('alert')).toBeVisible();
  await expectLatest(page);
  await checkRaw(page);

  // Same-document navigation must not recreate App or discard the in-memory import.
  await page.evaluate(() => { location.hash = new URLSearchParams({ view: 'trends', gu: '마포구' }).toString(); });
  await expect(page.locator('header .scope-label')).toContainText('마포구');
  await expectLatest(page);
  await checkRaw(page);
  await audit();
  await page.getByRole('button', { name: '연결 해제', exact: true }).click();
  await expectEmpty(page);
  await audit();
});

test('mobile performance: import is usable on a narrow screen and does not survive reload', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const audit = await privacyAudit(page, baseURL!);
  await page.goto('/#view=performance');
  await expectEmpty(page);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    panel(page).getByRole('button', { name: '야놀자 CSV 연결', exact: true }).click(),
  ]);
  await chooser.setFiles(file(csv));
  await expectLatest(page);
  await checkRaw(page);
  const bounds = await panel(page).boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  await audit();
  await page.reload();
  await expectEmpty(page);
  await expect(page.getByRole('button', { name: '연결 해제', exact: true })).toHaveCount(0);
  await audit();
});
