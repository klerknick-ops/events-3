-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "paymentTermsId" TEXT;

-- AlterTable
ALTER TABLE "EventTimeSlot" ADD COLUMN     "personCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "setupHeadTables" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setupId" TEXT,
ADD COLUMN     "setupManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setupTableCount" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "pricingMode" TEXT NOT NULL DEFAULT 'PER_PIECE';

-- CreateTable
CREATE TABLE "Setup" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupRule" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "minPersons" INTEGER NOT NULL,
    "tableCount" INTEGER,
    "headTables" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SetupRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTerms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "depositPercent" INTEGER,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTerms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Setup_spaceId_idx" ON "Setup"("spaceId");

-- CreateIndex
CREATE INDEX "SetupRule_setupId_idx" ON "SetupRule"("setupId");

-- CreateIndex
CREATE INDEX "PaymentTerms_organizationId_idx" ON "PaymentTerms"("organizationId");

-- CreateIndex
CREATE INDEX "EventTimeSlot_setupId_idx" ON "EventTimeSlot"("setupId");

-- AddForeignKey
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "BookableSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupRule" ADD CONSTRAINT "SetupRule_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTerms" ADD CONSTRAINT "PaymentTerms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_paymentTermsId_fkey" FOREIGN KEY ("paymentTermsId") REFERENCES "PaymentTerms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTimeSlot" ADD CONSTRAINT "EventTimeSlot_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
