"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type {
  EventTemplate,
  Product,
  Space,
  TaskTemplate,
} from "@/lib/types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { Modal } from "@/components/Modal";

interface SlotDraft {
  spaceId: string;
  label: string;
  startTime: string;
  durationMin: number;
  dayOffset: number;
}
interface ProductDraft {
  productId: string;
  quantity: number;
  slotIndex: number | null; // which slot (by order) this product attaches to
}
interface TaskDraft {
  taskTemplateId: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setTemplates(await api.get<EventTemplate[]>("/api/templates"));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Starter packages that pre-fill slots, products, and tasks for new
          events.
        </p>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
        >
          + New template
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No templates yet"
          description="Create a “Standard Wedding Package” or “Business Lunch” to book events in seconds."
          action={<Button onClick={() => setShowForm(true)}>+ New template</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="font-medium text-ink">{t.name}</div>
              {t.description ? (
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
                  {t.description}
                </p>
              ) : null}
              <div className="mt-3 flex gap-3 text-xs text-ink-muted">
                <span>🕑 {t._count?.slots ?? 0} slots</span>
                <span>🍽 {t._count?.products ?? 0} products</span>
                <span>✓ {t._count?.tasks ?? 0} tasks</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(t.id);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await api.del(`/api/templates/${t.id}`);
                    load();
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <TemplateForm
          templateId={editingId}
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

function TemplateForm({
  templateId,
  onClose,
  onSaved,
}: {
  templateId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [ready, setReady] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [prods, setProds] = useState<ProductDraft[]>([]);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [sp, pr, tt] = await Promise.all([
        api.get<Space[]>("/api/spaces"),
        api.get<Product[]>("/api/products"),
        api.get<TaskTemplate[]>("/api/task-templates"),
      ]);
      setSpaces(sp);
      setProducts(pr);
      setTaskTemplates(tt);
      if (templateId) {
        const t = await api.get<EventTemplate>(`/api/templates/${templateId}`);
        setName(t.name);
        setDescription(t.description ?? "");
        setSlots(
          (t.slots ?? []).map((s) => ({
            spaceId: s.spaceId ?? "",
            label: s.label ?? "",
            startTime: s.startTime,
            durationMin: s.durationMin,
            dayOffset: s.dayOffset,
          })),
        );
        {
          // Each product maps to its slot index (null = template-level / legacy).
          const fromSlots = (t.slots ?? []).flatMap((s, i) =>
            (s.products ?? []).map((p) => ({
              productId: p.productId,
              quantity: p.quantity,
              slotIndex: i,
            })),
          );
          const legacy = (t.products ?? [])
            .filter((p) => !p.templateSlotId)
            .map((p) => ({ productId: p.productId, quantity: p.quantity, slotIndex: null }));
          setProds([...fromSlots, ...legacy]);
        }
        setTasks(
          (t.tasks ?? []).map((tk) => ({ taskTemplateId: tk.taskTemplateId })),
        );
      }
      setReady(true);
    })();
  }, [templateId]);

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
        description: description.trim() || null,
        slots: slots
          .filter((s) => s.startTime)
          .map((s) => ({
            spaceId: s.spaceId || null,
            label: s.label || null,
            startTime: s.startTime,
            durationMin: Number(s.durationMin) || 60,
            dayOffset: Number(s.dayOffset) || 0,
          })),
        products: prods
          .filter((p) => p.productId)
          .map((p) => ({
            productId: p.productId,
            quantity: Number(p.quantity) || 1,
            slotIndex: p.slotIndex,
          })),
        tasks: tasks.filter((t) => t.taskTemplateId),
      };
      if (templateId) await api.patch(`/api/templates/${templateId}`, payload);
      else await api.post("/api/templates", payload);
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
      size="lg"
      title={templateId ? "Edit template" : "New template"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !ready}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </>
      }
    >
      {!ready ? (
        <div className="flex justify-center py-8 text-ink-muted">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Template name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Standard Wedding Package"
                autoFocus
              />
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ceremony + plated dinner reception"
              />
            </Field>
          </div>

          {/* Slots */}
          <Section
            title="Default time slots"
            onAdd={() =>
              setSlots((s) => [
                ...s,
                {
                  spaceId: spaces[0]?.id ?? "",
                  label: "",
                  startTime: "12:00",
                  durationMin: 120,
                  dayOffset: 0,
                },
              ])
            }
          >
            {slots.length === 0 ? (
              <Empty>No slots — add suggested spaces & times.</Empty>
            ) : (
              <div className="space-y-2">
                {slots.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 items-center gap-2 rounded-lg border border-base p-2"
                  >
                    <Input
                      className="col-span-3 h-9"
                      placeholder="Label"
                      value={s.label}
                      onChange={(e) =>
                        updateAt(setSlots, i, { label: e.target.value })
                      }
                    />
                    <Select
                      className="col-span-3 h-9"
                      value={s.spaceId}
                      onChange={(e) =>
                        updateAt(setSlots, i, { spaceId: e.target.value })
                      }
                    >
                      <option value="">No space</option>
                      {spaces.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="time"
                      className="col-span-2 h-9"
                      value={s.startTime}
                      onChange={(e) =>
                        updateAt(setSlots, i, { startTime: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      className="col-span-2 h-9"
                      title="Duration (minutes)"
                      value={s.durationMin}
                      onChange={(e) =>
                        updateAt(setSlots, i, {
                          durationMin: Number(e.target.value),
                        })
                      }
                    />
                    <div className="col-span-2 flex items-center gap-1">
                      <Input
                        type="number"
                        className="h-9"
                        title="Day offset"
                        value={s.dayOffset}
                        onChange={(e) =>
                          updateAt(setSlots, i, {
                            dayOffset: Number(e.target.value),
                          })
                        }
                      />
                      <button
                        onClick={() => removeAt(setSlots, i)}
                        className="text-ink-muted hover:text-rose-600"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-ink-muted">
                  Columns: label · space · start · duration (min) · day offset
                </p>
              </div>
            )}
          </Section>

          {/* Products (attached per time slot) */}
          <Section
            title="Default products"
            onAdd={() =>
              setProds((p) => [
                ...p,
                { productId: products[0]?.id ?? "", quantity: 1, slotIndex: slots.length ? 0 : null },
              ])
            }
          >
            {prods.length === 0 ? (
              <Empty>No products attached.</Empty>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-ink-muted">
                  Each product is attached to a time slot; applying the template pre-fills that
                  slot&rsquo;s products.
                </p>
                {prods.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      className="h-9 flex-1"
                      value={p.productId}
                      onChange={(e) =>
                        updateAt(setProds, i, { productId: e.target.value })
                      }
                    >
                      {products.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.title}
                        </option>
                      ))}
                    </Select>
                    <Select
                      className="h-9 w-40"
                      value={p.slotIndex == null ? "" : String(p.slotIndex)}
                      onChange={(e) =>
                        updateAt(setProds, i, {
                          slotIndex: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    >
                      <option value="">Whole event</option>
                      {slots.map((s, si) => (
                        <option key={si} value={si}>
                          {s.label || `Slot ${si + 1}`}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      className="h-9 w-20"
                      value={p.quantity}
                      onChange={(e) =>
                        updateAt(setProds, i, {
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                    <button
                      onClick={() => removeAt(setProds, i)}
                      className="text-ink-muted hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Tasks */}
          <Section
            title="Default tasks (deadline rules)"
            onAdd={() =>
              setTasks((t) => [
                ...t,
                { taskTemplateId: taskTemplates[0]?.id ?? "" },
              ])
            }
          >
            {taskTemplates.length === 0 ? (
              <Empty>
                Create task rules first under the “Task Rules” tab.
              </Empty>
            ) : tasks.length === 0 ? (
              <Empty>No tasks attached.</Empty>
            ) : (
              <div className="space-y-2">
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      className="h-9 flex-1"
                      value={t.taskTemplateId}
                      onChange={(e) =>
                        updateAt(setTasks, i, { taskTemplateId: e.target.value })
                      }
                    >
                      {taskTemplates.map((tt) => (
                        <option key={tt.id} value={tt.id}>
                          {tt.title}
                        </option>
                      ))}
                    </Select>
                    <button
                      onClick={() => removeAt(setTasks, i)}
                      className="text-ink-muted hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      )}
    </Modal>
  );
}

function Section({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <Button size="sm" variant="subtle" onClick={onAdd}>
          + Add
        </Button>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-base px-3 py-3 text-sm text-ink-muted">
      {children}
    </p>
  );
}

function updateAt<T>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  index: number,
  patch: Partial<T>,
) {
  setter((arr) => arr.map((x, i) => (i === index ? { ...x, ...patch } : x)));
}
function removeAt<T>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  index: number,
) {
  setter((arr) => arr.filter((_, i) => i !== index));
}
