"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import { TEMPLATE_VARIABLES } from "@/lib/doc-template";
import { Button, Card, Spinner, Textarea } from "@/components/ui";
import clsx from "clsx";

type Kind = "function_sheet" | "proposal" | "confirmation" | "proforma";
const KINDS: Kind[] = ["function_sheet", "proposal", "confirmation", "proforma"];
const KEYS: Record<Kind, string> = {
  function_sheet: "template_function_sheet",
  proposal: "template_proposal",
  confirmation: "template_confirmation",
  proforma: "template_proforma",
};
const LABELS: Record<Kind, string> = {
  function_sheet: "Function Sheet",
  proposal: "Proposal",
  confirmation: "Confirmation",
  proforma: "Pro Forma",
};

export default function SheetTemplatesPage() {
  const [kind, setKind] = useState<Kind>("function_sheet");
  const [values, setValues] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      const settings = await api.get<Record<string, string>>("/api/settings");
      const def = await api.get<Record<Kind, string>>("/api/doc-templates/defaults");
      setDefaults(def);
      const init: Record<string, string> = {};
      for (const k of KINDS) init[k] = settings[KEYS[k]] ?? def[k];
      setValues(init);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    await api.put("/api/settings", { key: KEYS[kind], value: values[kind] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Insert text at the textarea cursor (used by image insertion).
  function insertAtCursor(snippet: string) {
    const ta = taRef.current;
    const current = values[kind] ?? "";
    if (!ta) {
      setValues((v) => ({ ...v, [kind]: current + snippet }));
      return;
    }
    const start = ta.selectionStart ?? current.length;
    const end = ta.selectionEnd ?? current.length;
    const next = current.slice(0, start) + snippet + current.slice(end);
    setValues((v) => ({ ...v, [kind]: next }));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  async function onImagePicked(file: File) {
    setUploading(true);
    try {
      const res = await api.form<{ url: string }>("/api/uploads", (() => {
        const fd = new FormData();
        fd.set("file", file);
        return fd;
      })());
      insertAtCursor(`\n{{image:${res.url}}}\n`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-ink-muted">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">
        Edit the layout & wording of generated documents using variables. Lines
        starting with <code className="rounded bg-muted px-1">#</code> are titles,{" "}
        <code className="rounded bg-muted px-1">##</code> are section headings. Use
        the <strong>Insert image</strong> button to drop a logo or photo into the
        document.
      </p>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-base bg-surface p-0.5">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              kind === k ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-muted",
            )}
          >
            {LABELS[k]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImagePicked(f);
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "🖼 Insert image"}
            </Button>
            <span className="text-xs text-ink-muted">PNG or JPEG, inserted at the cursor.</span>
          </div>
          <Textarea
            ref={taRef}
            rows={22}
            className="font-mono text-xs"
            value={values[kind] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [kind]: e.target.value }))}
          />
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : `Save ${LABELS[kind]} template`}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setValues((v) => ({ ...v, [kind]: defaults[kind] }))}
            >
              Reset to default
            </Button>
            {saved ? <span className="text-sm text-emerald-600">Saved ✓</span> : null}
          </div>
        </div>

        <Card className="h-fit p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Available variables
          </div>
          <div className="space-y-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <div key={v.token} className="text-xs">
                <code className="rounded bg-muted px-1 py-0.5 text-ink">{v.token}</code>
                <span className="ml-1 text-ink-muted">{v.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
