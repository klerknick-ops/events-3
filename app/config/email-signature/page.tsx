"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import { useMe } from "@/components/MeProvider";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { EmailBody } from "@/components/inbox/EmailBody";
import {
  renderSignatureHtml,
  STARTER_SIGNATURE,
  type SignatureBlock,
} from "@/lib/signature";

type Block = SignatureBlock & Record<string, unknown>;

const BLOCK_LABELS: Record<SignatureBlock["type"], string> = {
  text: "Text line",
  image: "Image",
  links: "Link row",
  social: "Social row",
  banner: "Promo banner",
};

export default function EmailSignaturePage() {
  const me = useMe();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ blocks: Block[] }>("/api/email-signature")
      .then((r) => setBlocks(r.blocks))
      .finally(() => setLoading(false));
  }, []);

  function update(i: number, patch: Record<string, unknown>) {
    setBlocks((bs) => bs.map((b, j) => (j === i ? ({ ...b, ...patch } as Block) : b)));
  }
  function move(i: number, dir: -1 | 1) {
    setBlocks((bs) => {
      const next = [...bs];
      const j = i + dir;
      if (j < 0 || j >= next.length) return bs;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function remove(i: number) {
    setBlocks((bs) => bs.filter((_, j) => j !== i));
  }
  function add(type: SignatureBlock["type"]) {
    const defaults: Record<SignatureBlock["type"], Block> = {
      text: { type: "text", text: "New line", fontSize: 13 } as Block,
      image: { type: "image", src: "", width: 140 } as Block,
      links: { type: "links", items: [{ label: "Link", href: "#" }] } as Block,
      social: { type: "social", items: [{ label: "Instagram", href: "#" }] } as Block,
      banner: { type: "banner", overlayText: "Promo", ctaLabel: "Learn more", ctaHref: "#" } as Block,
    };
    setBlocks((bs) => [...bs, defaults[type]]);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/email-signature", { blocks });
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }

  const previewHtml = renderSignatureHtml(blocks as SignatureBlock[], {
    user_name: me.user?.name ?? "Your Name",
    user_email: me.user?.email ?? "you@venue.com",
    user_title: me.user?.title ?? "Job Title",
    user_phone: me.user?.phone ?? "T +31 20 000 0000",
    org: me.organizationName ?? "Your Company",
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-ink-muted">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">
          Build the company email signature from stacked blocks. Dynamic fields, replaced per
          sender:{" "}
          <code className="rounded bg-muted px-1">{"{{user_name}}"}</code>,{" "}
          <code className="rounded bg-muted px-1">{"{{user_title}}"}</code>,{" "}
          <code className="rounded bg-muted px-1">{"{{user_phone}}"}</code>,{" "}
          <code className="rounded bg-muted px-1">{"{{user_email}}"}</code>,{" "}
          <code className="rounded bg-muted px-1">{"{{org}}"}</code>. It loads automatically at the
          bottom of every composed email. (Set each person&rsquo;s title &amp; phone in Users.)
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setBlocks(STARTER_SIGNATURE as Block[])}>
            Reset to starter
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save signature"}
          </Button>
        </div>
      </div>
      {savedAt ? <p className="text-xs text-emerald-600">Saved at {savedAt}.</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-3">
          {blocks.map((b, i) => (
            <Card key={i} className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {BLOCK_LABELS[b.type]}
                </span>
                <div className="flex items-center gap-1 text-xs">
                  <button onClick={() => move(i, -1)} className="px-1 text-ink-muted hover:text-ink" title="Move up">
                    ↑
                  </button>
                  <button onClick={() => move(i, 1)} className="px-1 text-ink-muted hover:text-ink" title="Move down">
                    ↓
                  </button>
                  <button onClick={() => remove(i)} className="px-1 text-ink-muted hover:text-rose-600" title="Remove">
                    ✕
                  </button>
                </div>
              </div>
              <BlockEditor block={b} onChange={(patch) => update(i, patch)} />
            </Card>
          ))}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-base p-3">
            <span className="text-xs text-ink-muted">Add block:</span>
            {(Object.keys(BLOCK_LABELS) as SignatureBlock["type"][]).map((t) => (
              <Button key={t} size="sm" variant="subtle" onClick={() => add(t)}>
                + {BLOCK_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div>
          <div className="sticky top-20">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Preview (as {me.user?.name})
            </div>
            <Card className="p-4">
              <EmailBody html={previewHtml} isHtml />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- per-block field editors ----

function BlockEditor({ block, onChange }: { block: Block; onChange: (p: Record<string, unknown>) => void }) {
  switch (block.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Input value={block.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Text…" />
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
            <Toggle label="Bold" checked={!!block.bold} onChange={(v) => onChange({ bold: v })} />
            <Toggle label="Italic" checked={!!block.italic} onChange={(v) => onChange({ italic: v })} />
            <Toggle label="Underline" checked={!!block.underline} onChange={(v) => onChange({ underline: v })} />
            <label className="flex items-center gap-1">
              Size
              <Input
                type="number"
                className="h-8 w-16"
                value={block.fontSize ?? 13}
                onChange={(e) => onChange({ fontSize: Number(e.target.value) || 13 })}
              />
            </label>
          </div>
          <Input value={block.href ?? ""} onChange={(e) => onChange({ href: e.target.value })} placeholder="Link URL (optional) — makes the line a hyperlink" />
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <ImageField value={block.src} onChange={(src) => onChange({ src })} />
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-ink-soft">
              Width
              <Input type="number" className="h-8 w-20" value={block.width ?? 140} onChange={(e) => onChange({ width: Number(e.target.value) || undefined })} />
            </label>
            <Input className="h-8 flex-1" value={block.href ?? ""} onChange={(e) => onChange({ href: e.target.value })} placeholder="Link URL (optional)" />
          </div>
        </div>
      );
    case "links":
      return (
        <ItemList
          items={block.items as { label: string; href: string }[]}
          onChange={(items) => onChange({ items })}
          render={(it, set) => (
            <>
              <Input className="h-8 flex-1" value={it.label} onChange={(e) => set({ label: e.target.value })} placeholder="Label" />
              <Input className="h-8 flex-1" value={it.href} onChange={(e) => set({ href: e.target.value })} placeholder="URL" />
            </>
          )}
          empty={{ label: "Link", href: "#" }}
        />
      );
    case "social":
      return (
        <ItemList
          items={block.items as { label?: string; href: string; iconSrc?: string }[]}
          onChange={(items) => onChange({ items })}
          render={(it, set) => (
            <>
              <Input className="h-8 w-28" value={it.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder="Label" />
              <Input className="h-8 flex-1" value={it.href} onChange={(e) => set({ href: e.target.value })} placeholder="URL" />
              <div className="w-32"><ImageField compact value={it.iconSrc ?? ""} onChange={(iconSrc) => set({ iconSrc })} /></div>
            </>
          )}
          empty={{ label: "Social", href: "#" }}
        />
      );
    case "banner":
      return (
        <div className="space-y-2">
          <ImageField value={block.src ?? ""} onChange={(src) => onChange({ src })} label="Banner image (optional)" />
          <Input value={block.overlayText ?? ""} onChange={(e) => onChange({ overlayText: e.target.value })} placeholder="Overlay text" />
          <div className="flex gap-2">
            <Input className="flex-1" value={block.ctaLabel ?? ""} onChange={(e) => onChange({ ctaLabel: e.target.value })} placeholder="Button label" />
            <Input className="flex-1" value={block.ctaHref ?? ""} onChange={(e) => onChange({ ctaHref: e.target.value })} placeholder="Button URL" />
          </div>
        </div>
      );
    default:
      return null;
  }
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-base" />
      {label}
    </label>
  );
}

function ImageField({
  value,
  onChange,
  label,
  compact,
}: {
  value: string;
  onChange: (src: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok && j.url) onChange(j.url);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {label && !compact ? <div className="mb-1 text-xs text-ink-muted">{label}</div> : null}
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button size="sm" variant="secondary" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? "Uploading…" : compact ? "Icon" : "Upload"}
        </Button>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-8 w-8 rounded object-cover" />
        ) : (
          <span className="text-xs text-ink-muted">No image</span>
        )}
        {value ? (
          <button onClick={() => onChange("")} className="text-xs text-ink-muted hover:text-rose-600">
            clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ItemList<T extends Record<string, unknown>>({
  items,
  onChange,
  render,
  empty,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  empty: T;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          {render(it, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 text-ink-muted hover:text-rose-600"
            title="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <Button size="sm" variant="subtle" onClick={() => onChange([...items, { ...empty }])}>
        + Add item
      </Button>
    </div>
  );
}
