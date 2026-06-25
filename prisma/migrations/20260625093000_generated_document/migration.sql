-- Document version history for line-item diff highlighting.
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeneratedDocument_eventId_docType_version_key" ON "GeneratedDocument"("eventId", "docType", "version");
CREATE INDEX "GeneratedDocument_organizationId_idx" ON "GeneratedDocument"("organizationId");
CREATE INDEX "GeneratedDocument_eventId_docType_idx" ON "GeneratedDocument"("eventId", "docType");

ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
