"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { Setup, SetupRule, Space } from "@/lib/types";
import { Button, Input, Spinner } from "@/components/ui";
import { Modal } from "@/components/Modal";

type RuleDraft = {
  minPersons: number;
  tableCount: number | null;
  headTables: boolean;
  note: string;
};

// Manage the room setups (layouts) for one bookable space, including the
// threshold rules keyed off person count.
export function SetupManager({ space, onClose }: { space: Space; onClose: () => void }) {
  const [setups, setSetups] = useState<Setup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Setup | "new" | null>(null);

  async function load() {
    setLoading(true);
    setSetups(await api.get<Setup[]>(`/api/spaces/${space.id}/setups`));
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id]);

  return (
    <Modal open onClose={onClose} size="lg" title={`Setups · ${space.name}`}>
      {editing ? (
        <SetupEditor
          spaceId={space.id}
          setup={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : loading ? (
        <div className="flex justify-center py-8 text-ink-muted">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Layouts available for this space, with auto-rules based on the slot&rsquo;s
            person count.
          </p>
          {setups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-base px-3 py-4 text-sm text-ink-muted">
              No setups yet for this space.
            </p>
          ) : (
            <div className="divide-y divide-base rounded-lg border border-base">
              {setups.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{s.name}</div>
                    <div className="text-xs text-ink-muted">
                      {s.rules && s.rules.length
                        ? s.rules
                            .map(
                              (r) =>
                                `${r.minPersons}+ → ${r.tableCount ?? "?"} table${r.tableCount === 1 ? "" : "s"}${r.headTables ? " + head" : ""}`,
                            )
                            .join("  ·  ")
                        : "No auto-rules"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded px-2 py-1 text-xs text-ink-muted hover:bg-muted"
                      onClick={() => setEditing(s)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10"
                      onClick={async () => {
                        await api.del(`/api/setups/${s.id}`);
                        load();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="subtle" size="sm" onClick={() => setEditing("new")}>
            + Add setup
          </Button>
        </div>
      )}
    </Modal>
  );
}

function SetupEditor({
  spaceId,
  setup,
  onCancel,
  onSaved,
}: {
  spaceId: string;
  setup: Setup | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(setup?.name ?? "");
  const [rules, setRules] = useState<RuleDraft[]>(
    (setup?.rules ?? []).map((r: SetupRule) => ({
      minPersons: r.minPersons,
      tableCount: r.tableCount,
      headTables: r.headTables,
      note: r.note ?? "",
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<RuleDraft>) {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!name.trim()) return setError("Setup name is required");
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        rules: rules
          .filter((r) => r.minPersons >= 0)
          .map((r) => ({
            minPersons: r.minPersons,
            tableCount: r.tableCount,
            headTables: r.headTables,
            note: r.note || null,
          })),
      };
      if (setup) await api.patch(`/api/setups/${setup.id}`, payload);
      else await api.post(`/api/spaces/${spaceId}/setups`, payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">
          Setup name
        </label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Banquet rounds" autoFocus />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Auto-rules (by person count)
          </span>
          <Button
            size="sm"
            variant="subtle"
            onClick={() =>
              setRules((rs) => [...rs, { minPersons: 0, tableCount: 1, headTables: false, note: "" }])
            }
          >
            + Rule
          </Button>
        </div>
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-base px-3 py-3 text-sm text-ink-muted">
            No rules — this setup applies as-is at any person count.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <span className="col-span-3">Guests ≥</span>
              <span className="col-span-3">Tables</span>
              <span className="col-span-2">Head</span>
              <span className="col-span-4">Note</span>
            </div>
            {rules.map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="col-span-3 h-9"
                  value={r.minPersons}
                  onChange={(e) => update(i, { minPersons: Number(e.target.value) || 0 })}
                />
                <Input
                  type="number"
                  min={1}
                  className="col-span-3 h-9"
                  value={r.tableCount ?? ""}
                  onChange={(e) =>
                    update(i, { tableCount: e.target.value ? Number(e.target.value) : null })
                  }
                />
                <label className="col-span-2 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={r.headTables}
                    onChange={(e) => update(i, { headTables: e.target.checked })}
                    className="h-4 w-4 rounded border-base"
                  />
                </label>
                <div className="col-span-4 flex items-center gap-1">
                  <Input
                    className="h-9"
                    value={r.note}
                    onChange={(e) => update(i, { note: e.target.value })}
                    placeholder="optional"
                  />
                  <button
                    className="text-ink-muted hover:text-rose-600"
                    onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Back
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save setup"}
        </Button>
      </div>
    </div>
  );
}
