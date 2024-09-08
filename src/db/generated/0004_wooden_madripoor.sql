DO $$ BEGIN
 CREATE TYPE "public"."batch_status_enum" AS ENUM('waiting', 'in_progress', 'completed', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google-map-contrib_batch_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"contributorId" text NOT NULL,
	"status" "batch_status_enum" NOT NULL,
	"created_at" timestamp DEFAULT now()
);
