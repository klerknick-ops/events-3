"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import { Input } from "@/components/ui";

export interface EventOption {
  id: string;
  title: string;
  status: string;
  contactName: string;
  date: string | null;
}

// Searchable event picker used to link emails to an event.
export function EventLinkSelect({
  value,
  onChange,
  placeholder = "Search events…",
}: {
  value: string | null;
  onChange: (eventId: string | null, option?: EventOption) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<EventOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get<EventOption[]>(`/api/events/search?q=${encodeURIComponent(q)}`)
        .then((r) => active && setOptions(r))
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  const selected = useMemo(
    () => options.find((o) => o.id === value),
    [options, value],
  );

  return (
    <div className="relative">
      <Input
        value={open ? q : selected?.title ?? q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQ("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink"
        >
          clear
        </button>
      ) : null}
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-base bg-surface p-1 shadow-panel">
            {loading ? (
              <p className="px-3 py-2 text-sm text-ink-muted">Searching…</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-ink-muted">No events found.</p>
            ) : (
              options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id, o);
                    setOpen(false);
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="block font-medium text-ink">{o.title}</span>
                  <span className="block text-xs text-ink-muted">
                    {o.contactName}
                    {o.date
                      ? ` · ${new Date(o.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                      : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
