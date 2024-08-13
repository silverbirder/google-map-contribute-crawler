import { type Page } from "playwright";

export class GoogleMapContributeReviewsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async started(url: string): Promise<void> {
    if (url.includes("/contrib")) {
      await this.page.goto(url);
    } else {
      console.log("This is not a contrib page.");
    }
  }

  async scrollToLoadReviews(maxScrolls: number = 10): Promise<void> {
    await this.page.waitForSelector("[data-place-id]");
    let previousCount = 0;
    let currentCount = await this.page.$$eval(
      "[data-place-id]",
      (elements) => elements.length
    );
    let scrollAttempts = 0;

    while (previousCount !== currentCount && scrollAttempts < maxScrolls) {
      previousCount = currentCount;

      const reviewPanel = await this.page.$("[data-place-id]");
      const boundingBox = await reviewPanel?.boundingBox();
      if (!boundingBox) return;

      await this.page.mouse.move(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2
      );
      for (let i = 0; i < 10; i++) {
        await this.page.mouse.wheel(0, 10000);
        await this.page.waitForTimeout(1000);
      }

      currentCount = await this.page.$$eval(
        "[data-place-id]",
        (elements) => elements.length
      );

      scrollAttempts++;
    }

    if (scrollAttempts >= maxScrolls) {
      console.log(`最大スクロール回数(${maxScrolls})に達しました。`);
    } else {
      console.log("ページ下部に到達しました。");
    }
  }

  async clickAndCollectUrls(maxPlaces?: number): Promise<string[]> {
    const urls: string[] = [];
    const placeIds = await this.page.$$("[data-place-id]");
    const limit = maxPlaces ?? placeIds.length;
    for (let i = 0; i < placeIds.length && i < limit; i++) {
      const placeId = placeIds[i];
      await placeId.click();
      await this.page.waitForTimeout(2000);
      const url = this.page.url();
      urls.push(url);
      await this.page.goBack();
    }
    console.log(`すべてのURLを取得しました。取得したURL数: ${urls.length}`);
    return urls;
  }
}
