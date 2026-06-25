import { prisma } from "../db";
import { fetchInbox, isGraphConfigured, type IncomingMessage } from "./graph";

// ---------------------------------------------------------------------------
// Sync inbound mail into EmailMessage rows and auto-link client emails.
//
// Matching rule (Section 2.1): an inbound email whose sender matches an existing
// Contact who has an event is linked to that contact's most recent event and
// flagged autoMatched (Client Mail). Everything else stays unlinked and surfaces
// in Leads & Vendors.
//
// When Microsoft Graph isn't configured, the first sync seeds a small demo set
// so the inbox is usable in development; subsequent demo syncs are no-ops.
// ---------------------------------------------------------------------------

interface MatchResult {
  contactId: string | null;
  eventId: string | null;
  autoMatched: boolean;
}

async function matchSender(orgId: string, fromAddress: string): Promise<MatchResult> {
  const email = fromAddress.trim().toLowerCase();
  if (!email) return { contactId: null, eventId: null, autoMatched: false };
  const contact = await prisma.contact.findFirst({
    where: { organizationId: orgId, email: { equals: email, mode: "insensitive" } },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  if (!contact) return { contactId: null, eventId: null, autoMatched: false };
  const eventId = contact.events[0]?.id ?? null;
  return { contactId: contact.id, eventId, autoMatched: eventId !== null };
}

async function upsertIncoming(orgId: string, msg: IncomingMessage): Promise<void> {
  const existing = await prisma.emailMessage.findFirst({
    where: { organizationId: orgId, graphId: msg.graphId },
    select: { id: true },
  });
  if (existing) return; // already synced; preserve any manual labels/links

  const match = await matchSender(orgId, msg.fromAddress);
  await prisma.emailMessage.create({
    data: {
      organizationId: orgId,
      graphId: msg.graphId,
      conversationId: msg.conversationId,
      direction: "INBOUND",
      fromAddress: msg.fromAddress,
      fromName: msg.fromName,
      toAddresses: msg.toAddresses,
      subject: msg.subject,
      bodyPreview: msg.bodyPreview,
      body: msg.body,
      bodyIsHtml: msg.bodyIsHtml,
      receivedAt: new Date(msg.receivedAt),
      contactId: match.contactId,
      eventId: match.eventId,
      autoMatched: match.autoMatched,
    },
  });
}

export interface SyncResult {
  configured: boolean;
  fetched: number;
  created: number;
}

export async function syncMailbox(orgId: string): Promise<SyncResult> {
  if (!isGraphConfigured()) {
    const created = await seedDemoInbox(orgId);
    return { configured: false, fetched: created, created };
  }
  const messages = await fetchInbox(40);
  const before = await prisma.emailMessage.count({ where: { organizationId: orgId } });
  for (const m of messages) await upsertIncoming(orgId, m);
  const after = await prisma.emailMessage.count({ where: { organizationId: orgId } });
  return { configured: true, fetched: messages.length, created: after - before };
}

// Seed a believable demo dataset on first sync (no Graph credentials present).
async function seedDemoInbox(orgId: string): Promise<number> {
  const existing = await prisma.emailMessage.count({ where: { organizationId: orgId } });
  if (existing > 0) return 0;

  // Pull a couple of real contacts so client emails actually auto-match.
  const contacts = await prisma.contact.findMany({
    where: { organizationId: orgId, email: { not: null } },
    take: 3,
  });

  const now = Date.now();
  const hours = (h: number) => new Date(now - h * 3600_000).toISOString();
  const demo: IncomingMessage[] = [];

  contacts.forEach((c, i) => {
    demo.push({
      graphId: `demo-client-${c.id}`,
      conversationId: `demo-conv-${c.id}`,
      fromAddress: (c.email ?? "").toLowerCase(),
      fromName: `${c.firstName} ${c.lastName}`,
      toAddresses: "events@yourvenue.com",
      subject:
        i === 0
          ? "Re: Final guest numbers"
          : "Question about the running order",
      bodyPreview:
        i === 0
          ? "Hi, we'd like to confirm the final guest count and check on dietary requirements…"
          : "Could you let me know what time the room will be ready for set-up?",
      body:
        i === 0
          ? "<p>Hi,</p><p>We'd like to confirm the final guest count and check on dietary requirements. Could you also confirm the bar arrangements?</p><p>Many thanks!</p>"
          : "<p>Hello,</p><p>Could you let me know what time the room will be ready for set-up on the day? We have a florist arriving early.</p>",
      bodyIsHtml: true,
      receivedAt: hours(2 + i * 5),
    });
  });

  // Vendor / supplier / lead emails with no matching contact.
  demo.push(
    {
      graphId: "demo-vendor-florist",
      conversationId: "demo-conv-florist",
      fromAddress: "orders@bloomfloral.example",
      fromName: "Bloom Floral Studio",
      toAddresses: "events@yourvenue.com",
      subject: "Delivery window for Saturday's centerpieces",
      bodyPreview: "We can deliver the centerpieces between 9 and 11am — please confirm access…",
      body: "<p>Hi team,</p><p>We can deliver the centerpieces between 9 and 11am on Saturday. Please confirm loading-bay access.</p><p>— Bloom Floral</p>",
      bodyIsHtml: true,
      receivedAt: hours(6),
    },
    {
      graphId: "demo-supplier-av",
      conversationId: "demo-conv-av",
      fromAddress: "hello@brightav.example",
      fromName: "Bright AV Supplies",
      toAddresses: "events@yourvenue.com",
      subject: "Quote: PA + lighting hire",
      bodyPreview: "Thanks for the enquiry — attached is our quote for the PA and lighting package…",
      body: "<p>Hello,</p><p>Thanks for the enquiry. Here is our quote for the PA and lighting package. Let us know if you'd like to proceed.</p>",
      bodyIsHtml: true,
      receivedAt: hours(20),
    },
    {
      graphId: "demo-lead-newcouple",
      conversationId: "demo-conv-lead",
      fromAddress: "taylor.new@gmail.example",
      fromName: "Taylor Reyes",
      toAddresses: "events@yourvenue.com",
      subject: "Wedding enquiry for next spring",
      bodyPreview: "Hi! We're looking for a venue for around 90 guests next April and loved your photos…",
      body: "<p>Hi!</p><p>We're looking for a venue for around 90 guests next April and loved your photos. Do you have availability and a brochure you could share?</p><p>Thanks, Taylor</p>",
      bodyIsHtml: true,
      receivedAt: hours(30),
    },
  );

  for (const m of demo) await upsertIncoming(orgId, m);
  return demo.length;
}
