"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { EventFull, EventNote } from "@/lib/types";
import { Button, Spinner, Textarea } from "@/components/ui";
import { Empty, SectionHeader } from "../PanelBits";

export function NotesTab({
  event,
  reload,
}: {
  event: EventFull;
  reload: () => void;
}) {
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setNotes(await api.get<EventNote[]>(`/api/events/${event.id}/notes`));
    setLoading(false);
  }, [event.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!body.trim()) return;
    setSaving(true);
    await api.post(`/api/events/${event.id}/notes`, { body: body.trim() });
    setBody("");
    setSaving(false);
    load();
    reload(); // refresh activity count etc.
  }

  return (
    <section>
      <SectionHeader title="Notes" />
      <div className="mb-4">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add context — e.g. “client prefers vegetarian options for the head table”"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={add} disabled={saving || !body.trim()}>
            {saving ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6 text-ink-muted">
          <Spinner />
        </div>
      ) : notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-base p-3">
              <p className="whitespace-pre-wrap text-sm text-ink">{n.body}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                <span>
                  {n.author?.name ?? "Unknown"} ·{" "}
                  {new Date(n.createdAt).toLocaleString()}
                </span>
                <button
                  className="hover:text-rose-600"
                  onClick={async () => {
                    await api.del(`/api/notes/${n.id}`);
                    load();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
