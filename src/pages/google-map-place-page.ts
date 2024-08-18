import { Log } from "crawlee";
import { Locator, type Page } from "playwright";

export class GoogleMapPlacePage {
  readonly page: Page;
  readonly log: Log;
  private readonly maxRetries = 3;

  constructor(page: Page, log: Log) {
    this.page = page;
    this.log = log;
  }

  async clickReviewTab() {
    this.log.info("Clicking the review tab...");

    const reviewTabButton = await this.page.locator(
      'button[role="tab"][aria-label*="クチコミ"]'
    );
    await reviewTabButton.click();
    this.log.info("Review tab clicked.");
    await this.page.waitForSelector(
      'button[role="tab"][aria-label*="クチコミ"][aria-selected="true"]'
    );
  }

  async collectUrlsWithScrolling(): Promise<string[]> {
    const urls: string[] = [];
    const checkedReviews: string[] = [];
    let scrollAttempts = 0;
    while (scrollAttempts <= 10) {
      this.log.info(`Starting scroll attempt`, { scrollAttempts });

      if (checkedReviews.length % 10 === 0) {
        this.log.info("Scrolling page to load more reviews.");
        await this.scrollPage();
      }

      const reviews = await this.page
        .locator('[aria-label$="クチコミへのアクション"]')
        .all();
      this.log.info(`Found reviews on the page`, {
        reviewCount: reviews.length,
      });
      if (checkedReviews.length !== reviews.length) {
        this.log.info("Processing next review.", {
          checkedReviewsCount: checkedReviews.length,
        });
        const success = await this.processReview(reviews, checkedReviews, urls);
        if (success) {
          scrollAttempts = 0;
          this.log.info("Review processed successfully.");
        } else {
          scrollAttempts++;
          this.log.warning(
            "Failed to process review. Incrementing scroll attempt.",
            { scrollAttempts }
          );
        }
      } else {
        scrollAttempts++;
        this.log.warning("No new reviews found. Incrementing scroll attempt.", {
          scrollAttempts,
        });
      }
    }

    this.log.info(`Finished processing. Collected URLs.`, {
      urlCount: urls.length,
    });
    return urls;
  }

  private async scrollPage(): Promise<void> {
    const reviewTabButton = await this.page.locator(
      'button[role="tab"][aria-label*="クチコミ"]'
    );
    const boundingBox = await reviewTabButton.boundingBox();
    if (boundingBox) {
      this.log.info(
        "Moving mouse to center of the last review action element.",
        { boundingBox }
      );
      await this.page.mouse.move(
        boundingBox.x,
        boundingBox.y + boundingBox.height + 100
      );
    }
    for (let i = 0; i < 4; i++) {
      this.log.info(`Scrolling down the page`, { scrollAttempt: i + 1 });
      await this.page.mouse.wheel(0, 10000);
      await this.page.waitForTimeout(1000);
    }
  }

  private async processReview(
    reviews: Locator[],
    checkedReviews: string[],
    urls: string[]
  ): Promise<boolean> {
    let retryCount = 0;
    const ctx = this.page.context();
    ctx.grantPermissions(["clipboard-read"]);

    while (retryCount < this.maxRetries) {
      try {
        const nextReview = reviews[checkedReviews.length];
        this.log.info(`Processing review`, { index: checkedReviews.length });
        await nextReview.scrollIntoViewIfNeeded();
        const name = (await nextReview.getAttribute("aria-label")) ?? "";
        this.log.info(`Review name`, { name });

        await nextReview.click();

        this.log.info("Waiting for the action menu to appear.");
        await this.page.waitForSelector("#action-menu");

        const shareOption = await this.page.locator(
          'div[role="menuitemradio"]:has-text("クチコミを共有")'
        );
        await shareOption.click();

        this.log.info(
          "Clicked on 'クチコミを共有'. Waiting for 'リンクをコピー'."
        );
        await this.page.waitForSelector('button:has-text("リンクをコピー")');
        const copyLinkButton = await this.page.locator(
          'button:has-text("リンクをコピー")'
        );
        await copyLinkButton.click();
        const clipboardText = await this.page.evaluate(async () => {
          return await navigator.clipboard.readText();
        });

        // クリップボードの内容をログに出力
        this.log.info("Link copied to clipboard.", { clipboardText });
        urls.push(clipboardText);
        checkedReviews.push(name);
        this.log.info("Link copied. Pressing ESC to close the dialog.");
        await this.page.keyboard.press("Escape");

        return true;
      } catch (error) {
        retryCount++;
        this.log.error(`Attempt failed`, { retryCount, error });
      }
    }

    this.log.error("Max retries reached, skipping to the next review.");
    return false;
  }
}
