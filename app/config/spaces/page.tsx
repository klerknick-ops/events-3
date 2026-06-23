"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { Space } from "@/lib/types";
import { Button, Card, EmptyState, Field, Input, Spinner } from "@/components/ui";
import { Modal } from "@/components/Modal";

const PRESET_COLORS = [
  "#4f46e5", "#059669", "#d97706", "#0284c7", "#7c3aed",
  "#db2777", "#dc2626", "#0d9488", "#ca8a04", "#475569",
];

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Space | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setSpaces(await api.get<Space[]>("/api/spaces?includeArchived=1"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(s: Space) {
    setEditing(s);
    setShowForm(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Spaces appear as rows on the timeline.
        </p>
        <Button onClick={openNew}>+ New space</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : spaces.length === 0 ? (
        <EmptyState
          icon="🏛"
          title="No spaces yet"
          description="Add your first bookable space (a hall, room, or terrace) to start booking events."
          action={<Button onClick={openNew}>+ New space</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="mt-0.5 h-4 w-4 shrink-0 rounded"
                    style={{ background: s.color }}
                  />
                  <div>
                    <div className="font-medium text-ink">
                      {s.name}
                      {s.archived ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-ink-muted">
                          archived
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {s.capacity ? `Capacity ${s.capacity}` : "No capacity set"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (s.archived) {
                      await api.patch(`/api/spaces/${s.id}`, { archived: false });
                    } else {
                      await api.del(`/api/spaces/${s.id}`);
                    }
                    load();
                  }}
                >
                  {s.archived ? "Restore" : "Archive"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <SpaceForm
          space={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function SpaceForm({
  space,
  onClose,
  onSaved,
}: {
  space: Space | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(space?.name ?? "");
  const [capacity, setCapacity] = useState(space?.capacity?.toString() ?? "");
  const [color, setColor] = useState(space?.color ?? PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        capacity: capacity ? Number(capacity) : null,
        color,
      };
      if (space) await api.patch(`/api/spaces/${space.id}`, payload);
      else await api.post("/api/spaces", payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={space ? "Edit space" : "New space"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Grand Ballroom"
            autoFocus
          />
        </Field>
        <Field label="Capacity (optional)">
          <Input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="200"
          />
        </Field>
        <Field label="Timeline color">
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={
                  "h-8 w-8 rounded-lg ring-offset-2 transition " +
                  (color === c ? "ring-2 ring-ink" : "")
                }
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
