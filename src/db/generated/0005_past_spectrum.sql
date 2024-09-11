DO $$ BEGIN
 CREATE TYPE "public"."batch_status_type" AS ENUM('contrib', 'contrib-place', 'place', 'place-contrib');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "google-map-contrib_batch_status" ADD COLUMN "type" "batch_status_type" DEFAULT 'contrib';