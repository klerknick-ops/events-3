-- Connected inbox: emails synced from / sent through the Microsoft 365 mailbox.
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "graphId" TEXT,
    "conversationId" TEXT,
    "direction" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddresses" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "bodyIsHtml" BOOLEAN NOT NULL DEFAULT true,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "contactId" TEXT,
    "eventId" TEXT,
    "autoMatched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailMessage_organizationId_graphId_key" ON "EmailMessage"("organizationId", "graphId");
CREATE INDEX "EmailMessage_organizationId_idx" ON "EmailMessage"("organizationId");
CREATE INDEX "EmailMessage_eventId_idx" ON "EmailMessage"("eventId");
CREATE INDEX "EmailMessage_contactId_idx" ON "EmailMessage"("contactId");

ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
