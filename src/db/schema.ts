import {
  serial,
  timestamp,
  text,
  integer,
  pgTableCreator,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator(
  (name) => `google-map-contrib_${name}`
);

export const contributor = createTable("contributor", {
  id: serial("id").primaryKey(),
  name: text("name"),
  url: text("url"),
  profileImageUrl: text("profileImageUrl"),
  contributorId: text("contributorId"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const place = createTable("place", {
  id: serial("id").primaryKey(),
  name: text("name"),
  url: text("url"),
  profileImageUrl: text("profileImageUrl"),
  address: text("address"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const review = createTable("review", {
  id: serial("id").primaryKey(),
  contributorId: integer("contributor_id")
    .references(() => contributor.id)
    .notNull(),
  placeId: integer("place_id")
    .references(() => place.id)
    .notNull(),
  url: text("url"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
