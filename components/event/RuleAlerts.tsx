"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";

// Non-blocking constraint/notification warnings for the planner's current
// selection (Phase 6, Section 8). Styled like the Phase 3 setup suggestions
// (amber), not a separate alert style.
export function RuleAlerts({
  spaceId,
  setupId,
  productId,
  persons,
}: {
  spaceId?: string | null;
  setupId?: string | null;
  productId?: string | null;
  persons?: number | null;
}) {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (spaceId) params.set("spaceId", spaceId);
    if (setupId) params.set("setupId", setupId);
    if (productId) params.set("productId", productId);
    if (persons != null) params.set("persons", String(persons));
    if ([...params.keys()].length === 0) {
      setMessages([]);
      return;
    }
    let active = true;
    api
      .get<{ messages: string[] }>(`/api/notification-rules/match?${params.toString()}`)
      .then((r) => active && setMessages(r.messages))
      .catch(() => active && setMessages([]));
    return () => {
      active = false;
    };
  }, [spaceId, setupId, productId, persons]);

  if (messages.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-500/10">
      <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">⚠ Please note</div>
      <ul className="mt-1 space-y-1 text-xs text-amber-900 dark:text-amber-100">
        {messages.map((m, i) => (
          <li key={i}>• {m}</li>
        ))}
      </ul>
    </div>
  );
}
