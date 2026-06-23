"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { TEMPLATE_VARIABLES } from "@/lib/doc-template";
import { Button, Card, Spinner, Textarea } from "@/components/ui";
import clsx from "clsx";

type Kind = "function_sheet" | "proposal";
const KEYS: Record<Kind, string> = {
  function_sheet: "template_function_sheet",
  proposal: "template_proposal",
};
const LABELS: Record<Kind, string> = {
  function_sheet: "Function Sheet",
  proposal: "Proposal",
};

export default function SheetTemplatesPage() {
  const [kind, setKind] = useState<Kind>("function_sheet");
  const [values, setValues] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      // Fetch current settings + the built-in defaults (via a no-op render hint).
      const settings = await api.get<Record<string, string>>("/api/settings");
      const def = await api.get<{ function_sheet: string; proposal: string }>(
        "/api/doc-templates/defaults",
      );
      setDefaults({ function_sheet: def.function_sheet, proposal: def.proposal });
      setValues({
        function_sheet: settings[KEYS.function_sheet] ?? def.function_sheet,
        proposal: settings[KEYS.proposal] ?? def.proposal,
      });
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
        <code className="rounded bg-muted px-1">##</code> are section headings.
      </p>

      <div className="mb-4 flex gap-1 rounded-lg border border-base bg-surface p-0.5">
        {(["function_sheet", "proposal"] as Kind[]).map((k) => (
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
          <Textarea
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
