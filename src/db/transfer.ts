import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { eq, and } from "drizzle-orm";

export const transfer = async () => {
  const localConn = postgres(process.env.LOCAL_DATABASE_URL ?? "");
  const localDb = drizzle(localConn, { schema });
  const remoteConn = postgres(process.env.REMOTE_DATABASE_URL ?? "");
  const remoteDb = drizzle(remoteConn, { schema });

  // 特定のcontributorIdでフィルタリング
  const targetContributorId = "101722346324226588907";

  // ローカルDBからフィルタリングされたreviewを取得し、contributorとplaceをジョイン
  const reviews = await localDb
    .select()
    .from(schema.review)
    .leftJoin(
      schema.contributor,
      eq(schema.review.contributorId, schema.contributor.id)
    )
    .leftJoin(schema.place, eq(schema.review.placeId, schema.place.id))
    .where(eq(schema.contributor.contributorId, targetContributorId));

  const totalReviews = reviews.length;
  console.log(`Total reviews to process: ${totalReviews}`);

  let processedCount = 0;

  for (const review of reviews) {
    const { contributor, place, review: reviewData } = review;

    // リモートDBでのcontributorのIDを取得
    const [remoteContributor] = await remoteDb
      .select()
      .from(schema.contributor)
      .where(
        eq(schema.contributor.contributorId, contributor?.contributorId ?? "")
      )
      .limit(1);

    if (!remoteContributor) {
      console.error(
        `Contributor not found in remote DB: ${contributor?.contributorId}`
      );
      continue;
    }

    // リモートDBでのplaceのIDを取得
    const [remotePlace] = await remoteDb
      .select()
      .from(schema.place)
      .where(
        and(
          eq(schema.place.name, place?.name ?? ""),
          eq(schema.place.address, place?.address ?? "")
        )
      )
      .limit(1);

    if (!remotePlace) {
      console.error(
        `Place not found in remote DB: ${place?.name}, ${place?.address}`
      );
      continue;
    }

    // リモートDBに同じcontributorIdとplaceIdのレビューが存在するか確認
    const existingReview = await remoteDb
      .select()
      .from(schema.review)
      .where(
        and(
          eq(schema.review.contributorId, remoteContributor.id),
          eq(schema.review.placeId, remotePlace.id)
        )
      )
      .limit(1);

    if (existingReview.length > 0) {
      console.log(
        `Review already exists for contributorId: ${remoteContributor.id}, placeId: ${remotePlace.id}`
      );
      continue;
    }

    const remoteReview = {
      contributorId: remoteContributor.id,
      placeId: remotePlace.id,
      url: reviewData.url,
      createdAt: reviewData.createdAt,
      updatedAt: reviewData.updatedAt,
    };

    // リモートDBにreviewを挿入
    await remoteDb.insert(schema.review).values(remoteReview);

    processedCount += 1;
    console.log(
      `Review transferred: ${reviewData.url} (${processedCount}/${totalReviews})`
    );
  }

  console.log(
    `All reviews processed. Total reviews transferred: ${processedCount}`
  );

  // 接続を終了
  await localConn.end();
  await remoteConn.end();
};
