"use client";

import { useState } from "react";
import type { EventFull } from "@/lib/types";
import { Button } from "@/components/ui";

// Document export menu: Function Sheet (full event + per-day for multi-day) and
// Proposal, each as PDF or Word.
export function ExportMenu({ event }: { event: EventFull }) {
  const [open, setOpen] = useState(false);
  const multiDay = event.days.length > 1;
  const fs = (q: string) => `/api/events/${event.id}/function-sheet?${q}`;
  const pr = (q: string) => `/api/events/${event.id}/proposal?${q}`;

  return (
    <div className="relative">
      <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
        ⬇ Documents
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full z-50 mb-1 max-h-[60vh] w-64 overflow-y-auto rounded-xl border border-base bg-surface p-1 shadow-panel">
            <Label>Function Sheet</Label>
            <Item href={fs("format=pdf")} blank>
              {multiDay ? "Full event — PDF" : "PDF"}
            </Item>
            <Item href={fs("format=docx")}>{multiDay ? "Full event — Word" : "Word"}</Item>
            {multiDay
              ? event.days.map((d, i) => (
                  <Item key={d.id} href={fs(`format=pdf&day=${d.id}`)} blank>
                    Day {i + 1} (
                    {new Date(d.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    ) — PDF
                  </Item>
                ))
              : null}

            <div className="my-1 border-t border-base" />
            <Label>Proposal</Label>
            <Item href={pr("format=pdf")} blank>
              PDF
            </Item>
            <Item href={pr("format=docx")}>Word</Item>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
      {children}
    </div>
  );
}

function Item({
  href,
  blank,
  children,
}: {
  href: string;
  blank?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={blank ? "_blank" : undefined}
      rel="noreferrer"
      className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-muted"
    >
      {children}
    </a>
  );
}
