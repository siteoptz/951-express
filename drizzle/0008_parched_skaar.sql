ALTER TABLE "bookings" ADD COLUMN "vehicle_color" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "vehicle_vin" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_contact" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "delivery_contact" jsonb;