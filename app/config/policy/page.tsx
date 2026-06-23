"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, Card, Spinner, Textarea } from "@/components/ui";

export default function PolicyPage() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<Record<string, string>>("/api/settings").then((s) => {
      setValue(s.cancellation_policy ?? "");
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    await api.put("/api/settings" as string, {
      key: "cancellation_policy",
      value,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <p className="text-sm text-ink-muted">
          This text is pulled into every generated Proposal via the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{{cancellation_policy}}"}</code>{" "}
          placeholder.
        </p>
      </div>
      {loading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <Spinner />
        </div>
      ) : (
        <Card className="p-4">
          <Textarea
            rows={10}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Describe your cancellation and refund terms…"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save policy"}
            </Button>
            {saved ? <span className="text-sm text-emerald-600">Saved ✓</span> : null}
          </div>
        </Card>
      )}
    </div>
  );
}
