-- AlterTable
ALTER TABLE "WholesaleRule" ADD COLUMN     "quantitySwatch" JSONB,
ADD COLUMN     "quantitySwatchEnabled" BOOLEAN NOT NULL DEFAULT false;
