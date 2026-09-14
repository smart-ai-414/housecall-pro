/*
  Warnings:

  - Added the required column `confidence_score` to the `dimension_estimates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SessionEventType" ADD VALUE 'PERCEPTION_STARTED';
ALTER TYPE "SessionEventType" ADD VALUE 'PERCEPTION_SUCCEEDED';
ALTER TYPE "SessionEventType" ADD VALUE 'PERCEPTION_FAILED';
ALTER TYPE "SessionEventType" ADD VALUE 'PERCEPTION_SKIPPED';
ALTER TYPE "SessionEventType" ADD VALUE 'EXTRA_PHOTO_REQUESTED';
ALTER TYPE "SessionEventType" ADD VALUE 'EXTRA_PHOTO_DECLINED';
ALTER TYPE "SessionEventType" ADD VALUE 'DIMENSIONS_CONFIRMED';
ALTER TYPE "SessionEventType" ADD VALUE 'PRICING_BYPASSED';

-- AlterTable
ALTER TABLE "classifications" ADD COLUMN     "bypasses_pricing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observation_summary" TEXT,
ADD COLUMN     "photo_quality_problems" TEXT[];

-- AlterTable
ALTER TABLE "dimension_estimates" ADD COLUMN     "confidence_score" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "scale_reference_note" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "declined_photo_types" "PhotoType"[],
ADD COLUMN     "perception_run_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requested_photo_types" "PhotoType"[],
ADD COLUMN     "should_bypass_pricing" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "sessions_should_bypass_pricing_idx" ON "sessions"("should_bypass_pricing");
