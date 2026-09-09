-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REVIEWER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('STARTED', 'PHOTOS_RECEIVED', 'CLASSIFYING', 'QUESTIONING', 'MATCHING', 'SYNCED', 'ABANDONED', 'NEEDS_CALLBACK');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('INTERIOR_FLOOR_TO_CEILING', 'EXTERIOR_FULL_ELEVATION', 'CORNER_CLOSEUP');

-- CreateEnum
CREATE TYPE "ScaleReference" AS ENUM ('HEAD_HEIGHT', 'BRICK_COURSING', 'INTERIOR_FIXTURE', 'DELIBERATE_SCALE_OBJECT', 'FRAME_FACE');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('SYNC_PENDING', 'SYNC_FAILED', 'CREATED_UNSENT', 'SENT', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "invite_code_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "grants_role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchise_locations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "territory_definition" JSONB NOT NULL DEFAULT '{"zipCodes":[],"geoBoundary":null}',
    "housecall_pro_account_id" TEXT,
    "api_key_encrypted" TEXT,
    "price_book_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'STARTED',
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "service_address" TEXT,
    "franchise_location_id" UUID,
    "resume_token" TEXT NOT NULL,
    "conversation_state" JSONB NOT NULL DEFAULT '{"messages":[]}',
    "outstanding_questions" TEXT[],
    "last_customer_message_at" TIMESTAMP(3),
    "abandoned_at" TIMESTAMP(3),
    "is_test_record" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_photos" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "photo_type" "PhotoType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "original_width" INTEGER NOT NULL,
    "original_height" INTEGER NOT NULL,
    "is_heic_converted" BOOLEAN NOT NULL DEFAULT false,
    "exif_orientation_applied" BOOLEAN NOT NULL DEFAULT false,
    "metadata_stripped" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classifications" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "asset_type" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL,
    "frame_material_hint" TEXT,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "photo_quality_assessment" TEXT,
    "is_low_confidence" BOOLEAN NOT NULL DEFAULT false,
    "raw_model_output" JSONB NOT NULL,
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_estimates" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "width_inches" DOUBLE PRECISION NOT NULL,
    "height_inches" DOUBLE PRECISION NOT NULL,
    "square_footage" DOUBLE PRECISION NOT NULL,
    "scale_reference_used" "ScaleReference" NOT NULL,
    "customer_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "customer_corrected_width" DOUBLE PRECISION,
    "customer_corrected_height" DOUBLE PRECISION,
    "price_band" TEXT,
    "opening_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dimension_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue_matches" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "housecall_pro_service_id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_base_item" BOOLEAN NOT NULL DEFAULT false,
    "is_additional_opening" BOOLEAN NOT NULL DEFAULT false,
    "opening_index" INTEGER,
    "match_confidence" DOUBLE PRECISION NOT NULL,
    "needs_reviewer_completion" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogue_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "housecall_pro_estimate_id" TEXT,
    "housecall_pro_customer_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'SYNC_PENDING',
    "structured_notes_header" JSONB,
    "sync_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_sync_error" TEXT,
    "synced_at" TIMESTAMP(3),
    "is_test_record" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewer_edits" (
    "id" UUID NOT NULL,
    "estimate_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "field_changed" TEXT NOT NULL,
    "original_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviewer_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_log" (
    "id" UUID NOT NULL,
    "ip_address" TEXT NOT NULL,
    "session_count_today" INTEGER NOT NULL DEFAULT 0,
    "count_window_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_session_at" TIMESTAMP(3),
    "blocked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "invite_codes_is_active_idx" ON "invite_codes"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "franchise_locations_slug_key" ON "franchise_locations"("slug");

-- CreateIndex
CREATE INDEX "franchise_locations_is_active_idx" ON "franchise_locations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_resume_token_key" ON "sessions"("resume_token");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "sessions_customer_phone_idx" ON "sessions"("customer_phone");

-- CreateIndex
CREATE INDEX "sessions_customer_email_idx" ON "sessions"("customer_email");

-- CreateIndex
CREATE INDEX "sessions_franchise_location_id_idx" ON "sessions"("franchise_location_id");

-- CreateIndex
CREATE INDEX "sessions_created_at_idx" ON "sessions"("created_at");

-- CreateIndex
CREATE INDEX "sessions_status_last_customer_message_at_idx" ON "sessions"("status", "last_customer_message_at");

-- CreateIndex
CREATE INDEX "session_photos_session_id_idx" ON "session_photos"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_photos_session_id_photo_type_key" ON "session_photos"("session_id", "photo_type");

-- CreateIndex
CREATE INDEX "classifications_session_id_idx" ON "classifications"("session_id");

-- CreateIndex
CREATE INDEX "classifications_is_low_confidence_idx" ON "classifications"("is_low_confidence");

-- CreateIndex
CREATE INDEX "dimension_estimates_session_id_idx" ON "dimension_estimates"("session_id");

-- CreateIndex
CREATE INDEX "catalogue_matches_session_id_idx" ON "catalogue_matches"("session_id");

-- CreateIndex
CREATE INDEX "catalogue_matches_needs_reviewer_completion_idx" ON "catalogue_matches"("needs_reviewer_completion");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_session_id_key" ON "estimates"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_housecall_pro_estimate_id_key" ON "estimates"("housecall_pro_estimate_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_idempotency_key_key" ON "estimates"("idempotency_key");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE INDEX "estimates_created_at_idx" ON "estimates"("created_at");

-- CreateIndex
CREATE INDEX "reviewer_edits_estimate_id_idx" ON "reviewer_edits"("estimate_id");

-- CreateIndex
CREATE INDEX "reviewer_edits_reviewer_user_id_idx" ON "reviewer_edits"("reviewer_user_id");

-- CreateIndex
CREATE INDEX "reviewer_edits_field_changed_idx" ON "reviewer_edits"("field_changed");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_log_ip_address_key" ON "rate_limit_log"("ip_address");

-- CreateIndex
CREATE INDEX "rate_limit_log_blocked_until_idx" ON "rate_limit_log"("blocked_until");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invite_code_id_fkey" FOREIGN KEY ("invite_code_id") REFERENCES "invite_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_franchise_location_id_fkey" FOREIGN KEY ("franchise_location_id") REFERENCES "franchise_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_photos" ADD CONSTRAINT "session_photos_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_estimates" ADD CONSTRAINT "dimension_estimates_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue_matches" ADD CONSTRAINT "catalogue_matches_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_edits" ADD CONSTRAINT "reviewer_edits_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_edits" ADD CONSTRAINT "reviewer_edits_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
