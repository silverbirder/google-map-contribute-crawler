CREATE TABLE IF NOT EXISTS "google-map-contrib_contributor" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"url" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google-map-contrib_place" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"url" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google-map-contrib_review" (
	"id" serial PRIMARY KEY NOT NULL,
	"contributor_id" integer NOT NULL,
	"place_id" integer NOT NULL,
	"url" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "google-map-contrib_review" ADD CONSTRAINT "google-map-contrib_review_contributor_id_google-map-contrib_contributor_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."google-map-contrib_contributor"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "google-map-contrib_review" ADD CONSTRAINT "google-map-contrib_review_place_id_google-map-contrib_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."google-map-contrib_place"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
