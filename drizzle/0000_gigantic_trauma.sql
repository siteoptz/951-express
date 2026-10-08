CREATE TYPE "public"."booking_status" AS ENUM('held', 'paid', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('west', 'east');--> statement-breakpoint
CREATE TYPE "public"."size_class_source" AS ENUM('table', 'customer');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_token" text NOT NULL,
	"status" "booking_status" DEFAULT 'held' NOT NULL,
	"route_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"pickup_zip" text NOT NULL,
	"delivery_zip" text NOT NULL,
	"pickup_region" "region" NOT NULL,
	"delivery_region" "region" NOT NULL,
	"vehicle" jsonb NOT NULL,
	"operable" boolean NOT NULL,
	"modified" boolean NOT NULL,
	"top_deck" boolean DEFAULT false NOT NULL,
	"personal_items" boolean NOT NULL,
	"size_class" text NOT NULL,
	"size_class_source" "size_class_source" NOT NULL,
	"total_cents" integer NOT NULL,
	"deposit_cents" integer NOT NULL,
	"balance_cents" integer NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"terms_version" text NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent" text,
	"payer_email" text,
	"hold_expires_at" timestamp with time zone,
	"customer" jsonb,
	"pickup_address" jsonb,
	"delivery_address" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"details_submitted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "bookings_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "bookings_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"route_id" integer NOT NULL,
	"pickup_zip" text NOT NULL,
	"delivery_zip" text NOT NULL,
	"vehicle" jsonb NOT NULL,
	"operable" boolean NOT NULL,
	"modified" boolean NOT NULL,
	"top_deck" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"notes" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"size_class" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"example" text NOT NULL,
	"base_cents" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"pickup_region" "region" NOT NULL,
	"delivery_region" "region" NOT NULL,
	"weekly_capacity" integer DEFAULT 12 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "routes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_overrides" (
	"route_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"capacity_override" integer,
	"closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "week_overrides_route_id_week_start_pk" PRIMARY KEY("route_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_overrides" ADD CONSTRAINT "week_overrides_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_route_week_status_idx" ON "bookings" USING btree ("route_id","week_start","status");--> statement-breakpoint
CREATE INDEX "bookings_status_hold_expires_idx" ON "bookings" USING btree ("status","hold_expires_at");