import { type Page } from "playwright";
import * as fs from "fs";

export class GoogleAuthPage {
  readonly page: Page;
  readonly authFile: string = "src/auth/cookie.json";

  constructor(page: Page) {
    this.page = page;
  }

  async signIn(): Promise<void> {
    await this.page.getByLabel("ログイン").click();
    await this.page.waitForURL("https://www.google.co.jp/maps", {
      timeout: 1800000,
    });
    const cookies = await this.page.context().cookies();
    fs.writeFileSync(this.authFile, JSON.stringify(cookies, null, 2));
    console.log(`Cookies have been saved to ${this.authFile}`);
  }
}
