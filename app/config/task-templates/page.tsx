"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { TaskTemplate } from "@/lib/types";
import {
  TASK_DEADLINE_BASES,
  TASK_DEADLINE_BASIS_LABELS,
  type TaskDeadlineBasis,
} from "@/lib/enums";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
} from "@/components/ui";
import { Modal } from "@/components/Modal";

export default function TaskTemplatesPage() {
  const [items, setItems] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);

  async function load() {
    setLoading(true);
    setItems(await api.get<TaskTemplate[]>("/api/task-templates"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Reusable deadline rules. Attach these to event templates so tasks are
          auto-generated with the right due dates.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + New rule
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="⏱"
          title="No task rules yet"
          description="Create deadline rules like “Confirm menu — 14 days before the event.”"
          action={<Button onClick={() => setShowForm(true)}>+ New rule</Button>}
        />
      ) : (
        <Card className="divide-y divide-base">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="font-medium text-ink">{t.title}</div>
                <div className="text-xs text-ink-muted">
                  {t.offsetDays} {TASK_DEADLINE_BASIS_LABELS[t.basis]}
                  {t.defaultAssignee ? ` · ${t.defaultAssignee}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(t);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await api.del(`/api/task-templates/${t.id}`);
                    load();
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm ? (
        <RuleForm
          rule={editing}
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

function RuleForm({
  rule,
  onClose,
  onSaved,
}: {
  rule: TaskTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(rule?.title ?? "");
  const [assignee, setAssignee] = useState(rule?.defaultAssignee ?? "");
  const [offsetDays, setOffsetDays] = useState(
    rule?.offsetDays?.toString() ?? "7",
  );
  const [basis, setBasis] = useState<TaskDeadlineBasis>(
    rule?.basis ?? "BEFORE_EVENT",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        defaultAssignee: assignee.trim() || null,
        offsetDays: Number(offsetDays) || 0,
        basis,
      };
      if (rule) await api.patch(`/api/task-templates/${rule.id}`, payload);
      else await api.post("/api/task-templates", payload);
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
      title={rule ? "Edit task rule" : "New task rule"}
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
        <Field label="Task title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Confirm menu & dietary requirements"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Days">
            <Input
              type="number"
              value={offsetDays}
              onChange={(e) => setOffsetDays(e.target.value)}
            />
          </Field>
          <Field label="Relative to">
            <Select
              value={basis}
              onChange={(e) => setBasis(e.target.value as TaskDeadlineBasis)}
            >
              {TASK_DEADLINE_BASES.map((b) => (
                <option key={b} value={b}>
                  {TASK_DEADLINE_BASIS_LABELS[b]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Default assignee (optional)">
          <Input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="Coordinator"
          />
        </Field>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
