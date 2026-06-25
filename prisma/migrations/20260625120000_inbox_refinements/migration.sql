-- Phase 5 inbox refinements: CC, attachments, ownership, soft delete,
-- event assignee, and email-linked / standalone tasks.

-- EmailMessage: CC, owner, soft delete.
ALTER TABLE "EmailMessage" ADD COLUMN "ccAddresses" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Event: assigned/responsible staff member.
ALTER TABLE "Event" ADD COLUMN "assignedUserId" TEXT;
ALTER TABLE "Event" ADD CONSTRAINT "Event_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- EmailAttachment.
CREATE TABLE "EmailAttachment" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "storageKey" TEXT,
    "graphAttachmentId" TEXT,
    "isInline" BOOLEAN NOT NULL DEFAULT false,
    "contentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailAttachment_emailMessageId_idx" ON "EmailAttachment"("emailMessageId");
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task: org-scope (backfill from event), optional event, optional source email.
ALTER TABLE "Task" ADD COLUMN "organizationId" TEXT;
UPDATE "Task" t SET "organizationId" = e."organizationId" FROM "Event" e WHERE t."eventId" = e."id";
ALTER TABLE "Task" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "eventId" DROP NOT NULL;
ALTER TABLE "Task" ADD COLUMN "emailMessageId" TEXT;

CREATE INDEX "Task_organizationId_idx" ON "Task"("organizationId");
CREATE INDEX "Task_emailMessageId_idx" ON "Task"("emailMessageId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The existing Task_eventId_fkey was created with ON DELETE CASCADE on a NOT NULL
-- column; dropping NOT NULL above keeps the cascade, which is what we want.
