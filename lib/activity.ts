import { prisma } from "./db";
import { EVENT_STATUS_LABELS, type EventStatus } from "./enums";

export interface ActivityInput {
  eventId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  summary: string;
}

// Record a single activity entry. Best-effort: logging must never break the
// underlying mutation, so failures are swallowed (and logged to the console).
// If organizationId isn't supplied it is derived from the event.
export async function logActivity(entry: ActivityInput): Promise<void> {
  try {
    let organizationId = entry.organizationId ?? null;
    if (!organizationId && entry.eventId) {
      const ev = await prisma.event.findUnique({
        where: { id: entry.eventId },
        select: { organizationId: true },
      });
      organizationId = ev?.organizationId ?? null;
    }
    await prisma.activityLog.create({
      data: {
        organizationId,
        eventId: entry.eventId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        summary: entry.summary,
      },
    });
  } catch (e) {
    console.error("[activity] failed to log", entry.action, e);
  }
}

// Compare two event records and produce activity entries for what changed.
export function diffEventChanges(
  before: { title: string; status: string; notes: string | null; contactId: string },
  after: { title: string; status: string; notes: string | null; contactId: string },
): Omit<ActivityInput, "eventId" | "userId">[] {
  const entries: Omit<ActivityInput, "eventId" | "userId">[] = [];

  if (before.title !== after.title) {
    entries.push({
      action: "EVENT_RENAMED",
      summary: `Renamed event to “${after.title}”`,
    });
  }
  if (before.status !== after.status) {
    const label = EVENT_STATUS_LABELS[after.status as EventStatus] ?? after.status;
    entries.push({
      action: "STATUS_CHANGED",
      summary: `Changed status to ${label}`,
    });
  }
  if ((before.notes ?? "") !== (after.notes ?? "")) {
    entries.push({
      action: "EVENT_EDITED",
      summary: "Updated event notes",
    });
  }
  if (before.contactId !== after.contactId) {
    entries.push({
      action: "EVENT_EDITED",
      summary: "Changed the linked client",
    });
  }

  return entries;
}
