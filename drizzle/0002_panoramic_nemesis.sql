ALTER TABLE "bookings" ADD COLUMN "team_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "customer_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "email_error" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "email_error" text;