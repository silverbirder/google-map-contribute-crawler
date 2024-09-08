ALTER TABLE "google-map-contrib_contributor" ADD COLUMN IF NOT EXISTS "profileImageUrl" text;--> statement-breakpoint
ALTER TABLE "google-map-contrib_place" ADD COLUMN IF NOT EXISTS "profileImageUrl" text;
