import { expect, test } from "@playwright/test";

const hub = "https://cybecho.github.io/gov-notices-hub/";
const embed = hub + "?embed=atlas";
const frameSelector = 'iframe[title="리서치 글 타임라인"]';

const timeline = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<title>리서치 글</title>
<style>
  body, h2 { margin: 0 }
  article { height: 1120px }
  @media (max-width: 500px) { article { height: 1640px } }
</style>
<article><h2>공개 리서치 글</h2></article>
<script>
  const article = document.querySelector("article");
  new ResizeObserver(() => parent.postMessage({
    type: "gov-hub:height",
    height: article.offsetHeight
  }, "*")).observe(article);
</script>
</html>`;

test.beforeEach(async ({ context, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin;
  await context.route("**/*", route => {
    const url = route.request().url();
    if (url === embed) {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: timeline });
    }
    if (url === hub) {
      return route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: "<h1>독립 허브</h1>",
      });
    }
    if (new URL(url).origin === appOrigin) return route.continue();
    return route.abort();
  });
});

test("주요 탐색, 새로고침, 독립 허브 원본 링크", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./#view=sources&gu=강남구&dong=12345678&period=2025_full");
  const nav = page.getByRole("navigation", { name: "주요 탐색" });
  const articles = nav.getByRole("button", { name: "리서치 글 모음" });

  await articles.click();
  await expect(page).toHaveURL(/#view=articles$/);
  await page.reload();
  await expect(articles).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "리서치 글 모음", exact: true })).toBeVisible();

  const frame = page.locator(frameSelector);
  await expect(frame).toHaveAttribute("src", embed);
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(page.frameLocator(frameSelector).getByRole("heading", { name: "공개 리서치 글" }))
    .toBeVisible();
  await expect(frame).toHaveCSS("height", "1120px");

  // A matching origin alone or a matching WindowProxy alone cannot set the height.
  await frame.evaluate(node => {
    const ownFrame = (node as HTMLIFrameElement).contentWindow;
    for (const [origin, source] of [
      ["https://cybecho.github.io", window],
      [window.location.origin, ownFrame],
    ] as const) {
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "gov-hub:height", height: 8000 }, origin, source,
      }));
    }
  });
  await expect(frame).toHaveCSS("height", "1120px");

  const original = page.getByRole("link", { name: "독립 허브 열기" });
  await expect(original).toHaveAttribute("href", hub);
  const opened = page.waitForEvent("popup");
  await original.click();
  const popup = await opened;
  await expect(popup).toHaveURL(hub);
  await expect(popup.getByRole("heading", { name: "독립 허브" })).toBeVisible();
  await popup.close();

  await nav.getByRole("button", { name: "자료 연결" }).click();
  await expect(page).toHaveURL(/#view=sources(?:&|$)/);
});

test("390px에서 주요 메뉴가 보이고 타임라인이 양방향으로 크기를 조절한다", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 760 });
  await page.goto("./#view=articles");
  const frame = page.locator(frameSelector);
  await expect(frame).toHaveCSS("height", "1120px");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(frame).toHaveCSS("height", "1640px");
  const buttons = page.getByRole("navigation", { name: "주요 탐색" }).getByRole("button");
  await expect(buttons).toHaveCount(5);
  for (const element of [...await buttons.all(), frame]) {
    await expect(element).toBeInViewport();
    const box = (await element.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
  }
  await expect(page.getByRole("link", { name: "독립 허브 열기" })).toBeInViewport();

  await page.setViewportSize({ width: 1200, height: 760 });
  await expect(frame).toHaveCSS("height", "1120px");
});

test("임베드 요청이 차단되어도 독립 허브 링크가 보인다", async ({ page }) => {
  await page.route(embed, route => route.abort());
  await page.goto("./#view=articles");
  const link = page.getByRole("link", { name: "독립 허브 열기" });
  await expect(link).toBeInViewport();
  await expect(link).toHaveAttribute("href", hub);
});
