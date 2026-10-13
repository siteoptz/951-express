ALTER TABLE "routes" ALTER COLUMN "weekly_capacity" SET DEFAULT 6;--> statement-breakpoint
ALTER TABLE "week_overrides" ADD COLUMN "top_deck_suv_override" integer;--> statement-breakpoint
ALTER TABLE "week_overrides" ADD COLUMN "top_deck_car_override" integer;