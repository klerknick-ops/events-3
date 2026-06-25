import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, created, parseBody, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { sendMail } from "@/lib/mail/graph";

const sendSchema = z.object({
  to: z.string().min(3, "A recipient is required"),
  subject: z.string().min(1, "A subject is required"),
  body: z.string().default(""),
  eventId: z.string().nullable().optional(),
});

// Compose & send through the connected mailbox, optionally linking the sent
// message to an event so it shows in that event's Inbox tab.
export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const body = await parseBody(req, sendSchema);

  const recipients = body.to
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (recipients.length === 0) return badRequest("A recipient is required");

  let eventId: string | null = null;
  if (body.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: body.eventId, organizationId: orgId },
      select: { id: true },
    });
    if (!event) return badRequest("Event not found");
    eventId = event.id;
  }

  const result = await sendMail({ to: recipients, subject: body.subject, body: body.body });

  // Record the outbound message locally so it appears in the inbox / event tab.
  const message = await prisma.emailMessage.create({
    data: {
      organizationId: orgId,
      direction: "OUTBOUND",
      fromAddress: "me",
      toAddresses: recipients.join(", "),
      subject: body.subject,
      bodyPreview: body.body.replace(/<[^>]+>/g, " ").slice(0, 200),
      body: body.body,
      bodyIsHtml: true,
      receivedAt: new Date(),
      isRead: true,
      eventId,
    },
  });

  return created({ sent: result.sent, message });
});
