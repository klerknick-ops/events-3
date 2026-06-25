"use client";

import { useEffect, useState } from "react";
import type { EventFull } from "@/lib/types";
import { api } from "@/lib/fetcher";
import { Button } from "@/components/ui";

type DocKind = "function_sheet" | "proposal" | "confirmation" | "proforma";
interface DocVersion {
  id: string;
  version: number;
  generatedAt: string;
}
type VersionMap = Record<DocKind, DocVersion[]>;

// Document export menu: Function Sheet (full event + per-day for multi-day),
// Proposal, Confirmation and Pro Forma — each as PDF or Word. When a document
// already has a prior version, "Highlight updates" marks changed line items.
export function ExportMenu({ event }: { event: EventFull }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [versions, setVersions] = useState<VersionMap | null>(null);
  const multiDay = event.days.length > 1;

  useEffect(() => {
    if (!open) return;
    api
      .get<VersionMap>(`/api/events/${event.id}/doc-versions`)
      .then(setVersions)
      .catch(() => setVersions(null));
  }, [open, event.id]);

  // Build a query string, appending the highlight flag when enabled.
  const q = (parts: string) => (highlight ? `${parts}&highlight=1` : parts);
  const url = (kind: string, parts: string) => `/api/events/${event.id}/${kind}?${q(parts)}`;

  const latest = (kind: DocKind) => versions?.[kind]?.[0]?.version ?? 0;
  // Highlight only does something once a prior full-event version exists.
  const anyPrior = versions
    ? Object.values(versions).some((v) => v.length >= 1)
    : false;

  return (
    <div className="relative">
      <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
        ⬇ Documents
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full z-50 mb-1 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-base bg-surface p-1 shadow-panel">
            <label
              className={
                "mb-1 flex items-start gap-2 rounded-lg px-3 py-2 text-sm " +
                (anyPrior ? "bg-accent/60 dark:bg-brand-600/10" : "opacity-60")
              }
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={highlight}
                onChange={(e) => setHighlight(e.target.checked)}
              />
              <span>
                <span className="font-medium text-ink">Highlight updates</span>
                <span className="block text-xs text-ink-muted">
                  Mark line items changed since the previous version in yellow.
                  {!anyPrior ? " (No prior version yet.)" : ""}
                </span>
              </span>
            </label>

            <DocSection
              title="Function Sheet"
              latest={latest("function_sheet")}
            >
              <Item href={url("function-sheet", "format=pdf")} blank>
                {multiDay ? "Full event — PDF" : "PDF"}
              </Item>
              <Item href={url("function-sheet", "format=docx")}>
                {multiDay ? "Full event — Word" : "Word"}
              </Item>
              {multiDay
                ? event.days.map((d, i) => (
                    <Item
                      key={d.id}
                      href={`/api/events/${event.id}/function-sheet?format=pdf&day=${d.id}`}
                      blank
                    >
                      Day {i + 1} (
                      {new Date(d.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      ) — PDF
                    </Item>
                  ))
                : null}
            </DocSection>

            <DocSection title="Proposal" latest={latest("proposal")}>
              <Item href={url("proposal", "format=pdf")} blank>
                PDF
              </Item>
              <Item href={url("proposal", "format=docx")}>Word</Item>
            </DocSection>

            <DocSection title="Confirmation" latest={latest("confirmation")}>
              <Item href={url("confirmation", "format=pdf")} blank>
                PDF
              </Item>
              <Item href={url("confirmation", "format=docx")}>Word</Item>
            </DocSection>

            <DocSection title="Pro Forma Invoice" latest={latest("proforma")}>
              <Item href={url("proforma", "format=pdf")} blank>
                PDF
              </Item>
              <Item href={url("proforma", "format=docx")}>Word</Item>
            </DocSection>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DocSection({
  title,
  latest,
  children,
}: {
  title: string;
  latest: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="my-1 border-t border-base" />
      <div className="flex items-center justify-between px-3 pb-0.5 pt-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          {title}
        </span>
        {latest > 0 ? (
          <span
            className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-muted"
            title={`${latest} version${latest === 1 ? "" : "s"} generated`}
          >
            v{latest}
          </span>
        ) : null}
      </div>
      {children}
    </>
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
