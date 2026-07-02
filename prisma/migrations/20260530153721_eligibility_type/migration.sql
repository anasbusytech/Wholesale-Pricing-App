-- AlterTable
ALTER TABLE "WholesaleRule" ADD COLUMN     "customerIds" JSONB,
ADD COLUMN     "eligibilityType" TEXT NOT NULL DEFAULT 'all';
