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
import { OwnerSelect } from "@/components/inbox/OwnerSelect";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, type EventStatus } from "@/lib/enums";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TRIGGER_LABELS: Record<string, string> = {
  RELATIVE: "Relative to event date",
  RECURRING: "Recurring",
  ACTION: "Action-based",
};
const ACTION_LABELS: Record<string, string> = {
  EMAIL_RECEIVED: "When an email is received",
  EMAIL_SENT: "When an email is sent",
  STATUS_CHANGE: "When event status changes",
};

function ruleSummary(t: TaskTemplate): string {
  if (t.triggerType === "RECURRING") {
    if (t.recurrenceFreq === "WEEKLY") return `Every ${WEEKDAYS[t.recurrenceWeekday ?? 1]}`;
    if (t.recurrenceFreq === "MONTHLY") {
      if (t.recurrenceOrdinal != null && t.recurrenceWeekday != null) {
        const ord = t.recurrenceOrdinal === -1 ? "last" : `#${t.recurrenceOrdinal}`;
        return `Monthly · ${ord} ${WEEKDAYS[t.recurrenceWeekday]}`;
      }
      return `Monthly · day ${t.recurrenceDay ?? 1}`;
    }
    return "Recurring";
  }
  if (t.triggerType === "ACTION") {
    const base = ACTION_LABELS[t.actionType ?? ""] ?? "Action";
    const st = t.actionType === "STATUS_CHANGE" && t.actionStatus ? ` → ${t.actionStatus}` : "";
    return `${base}${st} · due +${t.leadDays}d`;
  }
  return `${t.offsetDays} ${TASK_DEADLINE_BASIS_LABELS[t.basis]}`;
}

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
                  <span className="rounded bg-muted px-1.5 py-0.5">{TRIGGER_LABELS[t.triggerType]}</span>{" "}
                  {ruleSummary(t)}
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
  const [assignedUserId, setAssignedUserId] = useState<string | null>(rule?.assignedUserId ?? null);
  const [triggerType, setTriggerType] = useState(rule?.triggerType ?? "RELATIVE");
  const [offsetDays, setOffsetDays] = useState(rule?.offsetDays?.toString() ?? "7");
  const [basis, setBasis] = useState<TaskDeadlineBasis>(rule?.basis ?? "BEFORE_EVENT");
  // Recurring
  const [recurrenceFreq, setRecurrenceFreq] = useState(rule?.recurrenceFreq ?? "WEEKLY");
  const [recurrenceWeekday, setRecurrenceWeekday] = useState(String(rule?.recurrenceWeekday ?? 1));
  const [monthlyMode, setMonthlyMode] = useState<"day" | "ordinal">(
    rule?.recurrenceOrdinal != null ? "ordinal" : "day",
  );
  const [recurrenceDay, setRecurrenceDay] = useState(String(rule?.recurrenceDay ?? 1));
  const [recurrenceOrdinal, setRecurrenceOrdinal] = useState(String(rule?.recurrenceOrdinal ?? 1));
  // Action
  const [actionType, setActionType] = useState(rule?.actionType ?? "STATUS_CHANGE");
  const [actionStatus, setActionStatus] = useState(rule?.actionStatus ?? "CONFIRMED");
  const [leadDays, setLeadDays] = useState(String(rule?.leadDays ?? 7));

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
      const payload: Record<string, unknown> = {
        title: title.trim(),
        assignedUserId,
        triggerType,
        // Clear non-applicable trigger configs.
        offsetDays: triggerType === "RELATIVE" ? Number(offsetDays) || 0 : 0,
        basis,
        recurrenceFreq: null,
        recurrenceWeekday: null,
        recurrenceDay: null,
        recurrenceOrdinal: null,
        actionType: null,
        actionStatus: null,
        leadDays: Number(leadDays) || 7,
      };
      if (triggerType === "RECURRING") {
        payload.recurrenceFreq = recurrenceFreq;
        if (recurrenceFreq === "WEEKLY") {
          payload.recurrenceWeekday = Number(recurrenceWeekday);
        } else if (monthlyMode === "ordinal") {
          payload.recurrenceOrdinal = Number(recurrenceOrdinal);
          payload.recurrenceWeekday = Number(recurrenceWeekday);
        } else {
          payload.recurrenceDay = Number(recurrenceDay);
        }
      } else if (triggerType === "ACTION") {
        payload.actionType = actionType;
        if (actionType === "STATUS_CHANGE") payload.actionStatus = actionStatus;
      }
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

        <Field label="Trigger type">
          <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value as typeof triggerType)}>
            {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>

        {triggerType === "RELATIVE" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Days">
              <Input type="number" value={offsetDays} onChange={(e) => setOffsetDays(e.target.value)} />
            </Field>
            <Field label="Relative to">
              <Select value={basis} onChange={(e) => setBasis(e.target.value as TaskDeadlineBasis)}>
                {TASK_DEADLINE_BASES.map((b) => (
                  <option key={b} value={b}>
                    {TASK_DEADLINE_BASIS_LABELS[b]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        {triggerType === "RECURRING" ? (
          <div className="space-y-3">
            <Field label="Frequency">
              <Select value={recurrenceFreq} onChange={(e) => setRecurrenceFreq(e.target.value as typeof recurrenceFreq)}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </Select>
            </Field>
            {recurrenceFreq === "WEEKLY" ? (
              <Field label="Day of week">
                <Select value={recurrenceWeekday} onChange={(e) => setRecurrenceWeekday(e.target.value)}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="space-y-2">
                <Field label="Monthly pattern">
                  <Select value={monthlyMode} onChange={(e) => setMonthlyMode(e.target.value as "day" | "ordinal")}>
                    <option value="day">On a day of the month</option>
                    <option value="ordinal">On an ordinal weekday (e.g. 2nd Monday)</option>
                  </Select>
                </Field>
                {monthlyMode === "day" ? (
                  <Field label="Day of month (1–31)">
                    <Input type="number" min={1} max={31} value={recurrenceDay} onChange={(e) => setRecurrenceDay(e.target.value)} />
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ordinal">
                      <Select value={recurrenceOrdinal} onChange={(e) => setRecurrenceOrdinal(e.target.value)}>
                        <option value="1">1st</option>
                        <option value="2">2nd</option>
                        <option value="3">3rd</option>
                        <option value="4">4th</option>
                        <option value="-1">Last</option>
                      </Select>
                    </Field>
                    <Field label="Weekday">
                      <Select value={recurrenceWeekday} onChange={(e) => setRecurrenceWeekday(e.target.value)}>
                        {WEEKDAYS.map((d, i) => (
                          <option key={i} value={i}>
                            {d}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {triggerType === "ACTION" ? (
          <div className="space-y-3">
            <Field label="Trigger on">
              <Select value={actionType} onChange={(e) => setActionType(e.target.value as typeof actionType)}>
                {Object.entries(ACTION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            {actionType === "STATUS_CHANGE" ? (
              <Field label="When status becomes">
                <Select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)}>
                  {EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {EVENT_STATUS_LABELS[s as EventStatus]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Deadline = trigger date + days">
              <Input type="number" min={0} value={leadDays} onChange={(e) => setLeadDays(e.target.value)} />
            </Field>
          </div>
        ) : null}

        <Field label="Assignee">
          <OwnerSelect value={assignedUserId} onChange={setAssignedUserId} placeholder="Unassigned" />
        </Field>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
