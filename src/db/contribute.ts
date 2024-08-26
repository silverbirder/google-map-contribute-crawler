import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { contributor } from "./schema.js";
import { Contributor } from "../types.js";

export const saveContributorIfNotExistsOrUpdate = async (
  contributorData: Contributor
) => {
  if (!contributorData) return;

  const existingContributor = await db
    .select()
    .from(contributor)
    .where(eq(contributor.name, contributorData.name))
    .limit(1);

  if (existingContributor.length === 0) {
    // 新しいContributorを挿入
    await db.insert(contributor).values({
      name: contributorData.name,
      url: contributorData.url,
      profileImageUrl: contributorData.profileImageUrl,
      contributorId: contributorData.contributorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("Contributor saved:", contributorData.name);
  } else {
    // 既存のContributorがある場合、必要に応じて更新
    const currentData = existingContributor[0];

    const updatedData = {
      url: currentData.url || contributorData.url,
      profileImageUrl:
        currentData.profileImageUrl || contributorData.profileImageUrl,
      contributorId: currentData.contributorId || contributorData.contributorId,
      updatedAt: new Date(),
    };

    await db
      .update(contributor)
      .set(updatedData)
      .where(eq(contributor.id, currentData.id));

    console.log("Contributor updated:", contributorData.name);
  }
};
