import { Place } from "../types.js";
import { db } from "./index.js";
import { place, review } from "./schema.js";
import { eq, and, inArray } from "drizzle-orm";

export const savePlaceIfNotExistsOrUpdate = async (placeData: Place) => {
  if (!placeData) return;

  const existingPlace = await db
    .select()
    .from(place)
    .where(
      and(eq(place.name, placeData.name), eq(place.address, placeData.address))
    )
    .limit(1);

  if (existingPlace.length === 0) {
    await db.insert(place).values({
      name: placeData.name,
      url: placeData.url,
      profileImageUrl: placeData.profileImageUrl,
      address: placeData.address,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("Place saved:", placeData.name);
  } else {
    const currentData = existingPlace[0];

    const updatedData = {
      url: currentData.url || placeData.url,
      profileImageUrl: currentData.profileImageUrl || placeData.profileImageUrl,
      address: currentData.address || placeData.address,
      updatedAt: new Date(),
    };

    await db.update(place).set(updatedData).where(eq(place.id, currentData.id));

    console.log("Place updated:", placeData.name);
  }
};

export const getPlacesByContributorId = async (
  contributorId: number
): Promise<Place[]> => {
  const existingReviews = await db
    .select()
    .from(review)
    .where(eq(review.contributorId, contributorId));

  if (existingReviews.length === 0) {
    console.log("No reviews found for contributorId:", contributorId);
    return [];
  }

  const placeIds = existingReviews.map((r) => r.placeId);

  const existingPlaces = await db
    .select()
    .from(place)
    .where(inArray(place.id, placeIds));

  const places: Place[] = existingPlaces.map((placeData) => ({
    name: placeData.name ?? "",
    url: placeData.url ?? "",
    profileImageUrl: placeData.profileImageUrl ?? "",
    address: placeData.address ?? "",
  }));

  console.log("Places found:", places.map((p) => p.name).join(", "));
  return places;
};
