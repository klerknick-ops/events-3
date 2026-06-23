"use client";

import { useState } from "react";
import clsx from "clsx";

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-base px-3 py-3 text-sm text-ink-muted">
      {children}
    </p>
  );
}

export function MoneyRow({
  label,
  value,
  small,
  strong,
}: {
  label: string;
  value: string;
  small?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex justify-between",
        small ? "text-xs text-ink-muted" : "text-ink-soft",
        strong && "font-semibold text-ink",
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function QtyEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={1}
      defaultValue={value}
      key={value}
      onBlur={(e) => {
        const v = Math.max(1, Number(e.target.value) || 1);
        if (v !== value) onChange(v);
      }}
      className="h-8 w-14 rounded border border-base bg-surface px-2 text-center text-sm text-ink"
    />
  );
}

export function InlineTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (!editing) {
    return (
      <button
        className="text-left hover:underline"
        onClick={() => {
          setV(value);
          setEditing(true);
        }}
        title="Click to rename"
      >
        {value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (v.trim() && v !== value) onSave(v.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-full rounded border border-brand-300 bg-surface px-1 text-lg font-semibold text-ink"
    />
  );
}
