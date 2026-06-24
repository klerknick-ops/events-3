"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import type { Contact, EventFull, EventTemplate, PaymentTerms } from "@/lib/types";
import { Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { PanelHeader } from "@/components/SidePanel";
import { ContactPicker } from "./ContactPicker";
import { ymd } from "@/lib/dates";
import clsx from "clsx";

type Path = "template" | "custom";

export function NewEventPanel({
  prefill,
  defaultDate,
  onClose,
  onCreated,
}: {
  prefill?: { spaceId: string; startsAt: string; endsAt: string };
  defaultDate: string;
  onClose: () => void;
  onCreated: (eventId: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [contact, setContact] = useState<Contact | null>(null);

  return (
    <>
      <PanelHeader
        title="New event"
        subtitle={
          <StepDots step={step} contactName={contact ? `${contact.firstName} ${contact.lastName}` : null} />
        }
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {step === 1 ? (
          <div>
            <SectionTitle n={1} title="Who is this event for?" />
            <p className="mb-3 text-sm text-ink-muted">
              Attach a client before the event is created.
            </p>
            <ContactPicker
              onSelect={(c) => {
                setContact(c);
                setStep(2);
              }}
            />
          </div>
        ) : contact ? (
          <BuildStep
            contact={contact}
            prefill={prefill}
            defaultDate={defaultDate}
            onBack={() => setStep(1)}
            onCreated={onCreated}
          />
        ) : null}
      </div>
    </>
  );
}

function BuildStep({
  contact,
  prefill,
  defaultDate,
  onBack,
  onCreated,
}: {
  contact: Contact;
  prefill?: { spaceId: string; startsAt: string; endsAt: string };
  defaultDate: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const [path, setPath] = useState<Path>(prefill ? "custom" : "template");
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [title, setTitle] = useState(
    `${contact.lastName} event`,
  );
  const baseDateInit = prefill ? ymd(new Date(prefill.startsAt)) : defaultDate;
  const [baseDate, setBaseDate] = useState(baseDateInit);
  const [paymentTermsList, setPaymentTermsList] = useState<PaymentTerms[]>([]);
  const [paymentTermsId, setPaymentTermsId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<EventTemplate[]>("/api/templates").then(setTemplates);
    api.get<PaymentTerms[]>("/api/payment-terms").then(setPaymentTermsList);
  }, []);

  async function create() {
    if (!title.trim()) {
      setError("A title is required");
      return;
    }
    if (path === "template" && !templateId) {
      setError("Pick a template or switch to a custom build");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const event = await api.post<EventFull>("/api/events", {
        contactId: contact.id,
        title: title.trim(),
        baseDate,
        templateId: path === "template" ? templateId : null,
        paymentTermsId: paymentTermsId || null,
        prefill: path === "custom" ? prefill ?? null : null,
      });
      onCreated(event.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="flex items-center justify-between p-3">
        <div>
          <div className="text-sm font-medium text-ink">
            {contact.firstName} {contact.lastName}
          </div>
          <div className="text-xs text-ink-muted">
            {contact.company?.name ?? "Private individual"}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onBack}>
          Change
        </Button>
      </Card>

      <div>
        <SectionTitle n={2} title="Event details" />
        <div className="space-y-3">
          <Field label="Event title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mitchell–Brown Wedding"
              autoFocus
            />
          </Field>
          <Field
            label="Base date"
            hint="Template slots are scheduled relative to this date."
          >
            <Input
              type="date"
              value={baseDate}
              onChange={(e) => setBaseDate(e.target.value)}
            />
          </Field>
          <Field label="Payment terms">
            <Select
              value={paymentTermsId}
              onChange={(e) => setPaymentTermsId(e.target.value)}
            >
              <option value="">— None —</option>
              {paymentTermsList.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle n={3} title="How do you want to start?" />
        <div className="grid grid-cols-2 gap-2">
          <PathCard
            active={path === "template"}
            onClick={() => setPath("template")}
            title="From a template"
            desc="Pre-fill slots, products & tasks"
          />
          <PathCard
            active={path === "custom"}
            onClick={() => setPath("custom")}
            title="Custom build"
            desc="Start blank, add everything yourself"
          />
        </div>

        {path === "template" ? (
          <div className="mt-3 space-y-2">
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-base p-3 text-sm text-ink-muted">
                No templates yet — create one in Configuration, or switch to a
                custom build.
              </p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={clsx(
                    "flex w-full flex-col rounded-lg border px-3 py-2 text-left transition",
                    templateId === t.id
                      ? "border-brand-500 bg-accent ring-1 ring-brand-300"
                      : "border-base hover:border-brand-300",
                  )}
                >
                  <span className="text-sm font-medium text-ink">{t.name}</span>
                  {t.description ? (
                    <span className="text-xs text-ink-muted">
                      {t.description}
                    </span>
                  ) : null}
                  <span className="mt-1 text-[11px] text-ink-muted">
                    {t._count?.slots ?? 0} slots · {t._count?.products ?? 0}{" "}
                    products · {t._count?.tasks ?? 0} tasks
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-base p-3 text-sm text-ink-muted">
            {prefill
              ? "Starts with the slot you clicked on the timeline. Add more slots, products and tasks next."
              : "You’ll add time slots, products and tasks after creating the event."}
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="sticky bottom-0 -mx-5 border-t border-base bg-surface px-5 py-3">
        <Button onClick={create} disabled={creating} className="w-full">
          {creating ? "Creating…" : "Create event →"}
        </Button>
      </div>
    </div>
  );
}

function PathCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-lg border p-3 text-left transition",
        active
          ? "border-brand-500 bg-accent ring-1 ring-brand-300"
          : "border-base hover:border-brand-300",
      )}
    >
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="text-xs text-ink-muted">{desc}</div>
    </button>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-brand-700 dark:text-brand-300">
        {n}
      </span>
      {title}
    </h3>
  );
}

function StepDots({
  step,
  contactName,
}: {
  step: number;
  contactName: string | null;
}) {
  return (
    <span className="text-sm text-ink-muted">
      {step === 1 ? "Step 1 · Select client" : `Client: ${contactName}`}
    </span>
  );
}
