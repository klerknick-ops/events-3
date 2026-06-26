"use client";

import { useState } from "react";
import { useMe } from "@/components/MeProvider";
import { ContactEventList, type EventRow } from "@/components/event/ContactEventList";
import { ClientInbox } from "@/components/inbox/ClientInbox";

type Tab = "events" | "inbox";

// Events / Inbox tabs for a client (contact or company) profile. The Inbox tab
// is only shown to users with VIEW_GLOBAL_ACTIVITY (same gate as the Inbox).
export function ClientProfileTabs({
  events,
  emailsEndpoint,
}: {
  events: EventRow[];
  emailsEndpoint: string;
}) {
  const { permissions } = useMe();
  const canInbox = Boolean(permissions.VIEW_GLOBAL_ACTIVITY);
  const [tab, setTab] = useState<Tab>("events");

  return (
    <div>
      <div className="mb-3 flex gap-1 border-b border-base">
        <TabBtn active={tab === "events"} onClick={() => setTab("events")} label={`Events (${events.length})`} />
        {canInbox ? <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")} label="Inbox" /> : null}
      </div>

      {tab === "events" ? (
        events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-base p-6 text-center text-sm text-ink-muted">
            No events for this client yet.
          </p>
        ) : (
          <ContactEventList events={events} />
        )
      ) : (
        <ClientInbox endpoint={emailsEndpoint} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
        (active
          ? "border-brand-600 text-brand-700 dark:text-brand-300"
          : "border-transparent text-ink-muted hover:text-ink")
      }
    >
      {label}
    </button>
  );
}
