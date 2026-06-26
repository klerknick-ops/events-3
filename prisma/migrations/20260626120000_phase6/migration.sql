-- Phase 6: notes, per-line overrides, user assignees, task-rule recurrence/
-- actions, email archive, per-slot template products, notification rules,
-- budgets & status weighting.

-- ----- Notes + per-line overrides -----
ALTER TABLE "EventTimeSlot" ADD COLUMN "notes" TEXT;
ALTER TABLE "EventProduct" ADD COLUMN "nameOverride" TEXT;
ALTER TABLE "EventProduct" ADD COLUMN "notes" TEXT;

-- ----- Email archive -----
ALTER TABLE "EmailMessage" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- ----- Task assignee as user -----
ALTER TABLE "Task" ADD COLUMN "assignedUserId" TEXT;
CREATE INDEX "Task_assignedUserId_idx" ON "Task"("assignedUserId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----- Task rules: assignee user + trigger types -----
ALTER TABLE "TaskTemplate" ADD COLUMN "assignedUserId" TEXT;
ALTER TABLE "TaskTemplate" ADD COLUMN "triggerType" TEXT NOT NULL DEFAULT 'RELATIVE';
ALTER TABLE "TaskTemplate" ADD COLUMN "recurrenceFreq" TEXT;
ALTER TABLE "TaskTemplate" ADD COLUMN "recurrenceWeekday" INTEGER;
ALTER TABLE "TaskTemplate" ADD COLUMN "recurrenceDay" INTEGER;
ALTER TABLE "TaskTemplate" ADD COLUMN "recurrenceOrdinal" INTEGER;
ALTER TABLE "TaskTemplate" ADD COLUMN "actionType" TEXT;
ALTER TABLE "TaskTemplate" ADD COLUMN "actionStatus" TEXT;
ALTER TABLE "TaskTemplate" ADD COLUMN "leadDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----- Template products per slot -----
ALTER TABLE "TemplateProduct" ADD COLUMN "templateSlotId" TEXT;
CREATE INDEX "TemplateProduct_templateSlotId_idx" ON "TemplateProduct"("templateSlotId");
ALTER TABLE "TemplateProduct" ADD CONSTRAINT "TemplateProduct_templateSlotId_fkey" FOREIGN KEY ("templateSlotId") REFERENCES "TemplateSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----- Notification / constraint rules -----
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "minPersons" INTEGER,
    "productId" TEXT,
    "setupId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationRule_organizationId_idx" ON "NotificationRule"("organizationId");
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationRuleSpace" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    CONSTRAINT "NotificationRuleSpace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationRuleSpace_ruleId_spaceId_key" ON "NotificationRuleSpace"("ruleId", "spaceId");
CREATE INDEX "NotificationRuleSpace_ruleId_idx" ON "NotificationRuleSpace"("ruleId");
CREATE INDEX "NotificationRuleSpace_spaceId_idx" ON "NotificationRuleSpace"("spaceId");
ALTER TABLE "NotificationRuleSpace" ADD CONSTRAINT "NotificationRuleSpace_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRuleSpace" ADD CONSTRAINT "NotificationRuleSpace_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "BookableSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----- Budgets & status weights -----
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Budget_organizationId_month_key" ON "Budget"("organizationId", "month");
CREATE INDEX "Budget_organizationId_idx" ON "Budget"("organizationId");
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StatusWeight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "weightPercent" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StatusWeight_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StatusWeight_organizationId_status_key" ON "StatusWeight"("organizationId", "status");
CREATE INDEX "StatusWeight_organizationId_idx" ON "StatusWeight"("organizationId");
ALTER TABLE "StatusWeight" ADD CONSTRAINT "StatusWeight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
