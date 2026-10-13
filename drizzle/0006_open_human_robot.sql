ALTER TABLE "bookings" ADD COLUMN "vehicle_typed" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "vehicle_typed" jsonb;