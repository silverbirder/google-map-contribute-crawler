import { eq, and } from "drizzle-orm";
import { db } from "./index.js";
import { review, contributor, place } from "./schema.js";
import { Review } from "../types.js";

export const saveReviewIfNotExistsOrUpdate = async (reviewData: Review) => {
  if (!reviewData) return;

  const [contributorRecord] = await db
    .select()
    .from(contributor)
    .where(eq(contributor.contributorId, reviewData.contributorId))
    .limit(1);

  const [placeRecord] = await db
    .select()
    .from(place)
    .where(eq(place.name, reviewData.place.name))
    .limit(1);

  if (!contributorRecord || !placeRecord) {
    console.error("Contributor or Place not found");
    return;
  }

  const existingReview = await db
    .select()
    .from(review)
    .where(
      and(
        eq(review.contributorId, contributorRecord.id),
        eq(review.placeId, placeRecord.id)
      )
    )
    .limit(1);

  if (existingReview.length === 0) {
    await db.insert(review).values({
      contributorId: contributorRecord.id,
      placeId: placeRecord.id,
      url: reviewData.url,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("Review saved:", reviewData.url);
  } else {
    const currentReview = existingReview[0];

    const updatedData = {
      url: reviewData.url || currentReview.url,
      updatedAt: new Date(),
    };

    await db
      .update(review)
      .set(updatedData)
      .where(eq(review.id, currentReview.id));

    console.log("Review updated:", reviewData.url);
  }
};
