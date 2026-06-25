import { prisma } from "@/lib/db";
import { badRequest, created, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { sendMail, type OutgoingAttachment } from "@/lib/mail/graph";
import { saveBytes } from "@/lib/storage";

// Compose & send through the connected mailbox. Accepts multipart/form-data so
// attachments can be uploaded. Supports CC, attachments, optional event link and
// an optional task created before sending (Phase 5, Sections 1 & 6).
//
// Outbound mail with no linked event lands in Leads & Vendors → Sent (the row is
// stored with direction OUTBOUND and no eventId); linking it to an event later
// also surfaces it in that event's Inbox tab.
export const POST = route(async (req) => {
  const { user, orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");

  const form = await req.formData();
  const to = String(form.get("to") || "").trim();
  const cc = String(form.get("cc") || "").trim();
  const subject = String(form.get("subject") || "").trim();
  const body = String(form.get("body") || "");
  const eventIdRaw = String(form.get("eventId") || "").trim();
  const taskTitle = String(form.get("taskTitle") || "").trim();
  const taskDueDate = String(form.get("taskDueDate") || "").trim();
  const taskAssignee = String(form.get("taskAssignee") || "").trim();

  const recipients = to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const ccList = cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) return badRequest("A recipient is required");
  if (!subject) return badRequest("A subject is required");

  let eventId: string | null = null;
  if (eventIdRaw) {
    const event = await prisma.event.findFirst({
      where: { id: eventIdRaw, organizationId: orgId },
      select: { id: true },
    });
    if (!event) return badRequest("Event not found");
    eventId = event.id;
  }

  // A task can only be created when there's a deadline (Phase 3 rule).
  if (taskTitle && !taskDueDate) {
    return badRequest("A deadline is required for the task");
  }

  // Collect uploaded files: store bytes + build base64 payloads for Graph.
  const files = form.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  const stored: { filename: string; contentType: string; size: number; key: string }[] = [];
  const outgoing: OutgoingAttachment[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const s = await saveBytes(buf, file.name, contentType, `${orgId}/email`);
    stored.push({ filename: file.name, contentType, size: buf.length, key: s.key });
    outgoing.push({ filename: file.name, contentType, contentBytes: buf.toString("base64") });
  }

  const result = await sendMail({
    to: recipients,
    cc: ccList,
    subject,
    body,
    attachments: outgoing,
  });

  const message = await prisma.emailMessage.create({
    data: {
      organizationId: orgId,
      direction: "OUTBOUND",
      fromAddress: "me",
      toAddresses: recipients.join(", "),
      ccAddresses: ccList.length ? ccList.join(", ") : null,
      subject,
      bodyPreview: body.replace(/<[^>]+>/g, " ").slice(0, 200),
      body,
      bodyIsHtml: true,
      receivedAt: new Date(),
      isRead: true,
      eventId,
      attachments: {
        create: stored.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          storageKey: a.key,
        })),
      },
    },
  });

  // Optional pre-send task (reuses the existing Task system; survives email
  // deletion via SetNull on Task.emailMessageId).
  let task = null;
  if (taskTitle) {
    task = await prisma.task.create({
      data: {
        organizationId: orgId,
        eventId,
        emailMessageId: message.id,
        title: taskTitle,
        assignee: taskAssignee || null,
        dueDate: new Date(taskDueDate),
      },
    });
  }

  return created({ sent: result.sent, message, task, by: user.id });
});
