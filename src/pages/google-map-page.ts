import { type Page } from "playwright";

export class GoogleMapPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async started(): Promise<void> {
    const baseUrl = "https://www.google.com/maps";
    await this.page.goto(baseUrl);
  }

  async continueUsingWebVersion(): Promise<void> {
    try {
      await this.page.waitForSelector('text="ウェブ版を引き続き使用"', {
        timeout: 5000,
      });
      await this.page.click('text="ウェブ版を引き続き使用"');
    } catch (error) {
      console.log("ウェブ版を引き続き使用ボタンが見つかりませんでした。");
    }
  }
}
