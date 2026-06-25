-- Consolidate per-person/per-piece pricing mode into Guest/Event product type.
-- Rename the column and remap the existing values, preserving data.
ALTER TABLE "Product" RENAME COLUMN "pricingMode" TO "productType";
ALTER TABLE "Product" ALTER COLUMN "productType" DROP DEFAULT;
UPDATE "Product" SET "productType" = CASE WHEN "productType" = 'PER_PERSON' THEN 'GUEST' ELSE 'EVENT' END;
ALTER TABLE "Product" ALTER COLUMN "productType" SET DEFAULT 'EVENT';
