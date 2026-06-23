"use client";

import { useEffect } from "react";

// Panel that slides in from the LEFT (per spec) and overlays the timeline.
export function SidePanel({
  open,
  onClose,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 animate-fade-in"
        onClick={onClose}
      />
      <div
        className="fixed left-0 top-0 bottom-0 z-50 flex w-full max-w-full flex-col bg-surface shadow-panel animate-panel-in"
        style={{ width }}
      >
        {children}
      </div>
    </>
  );
}

export function PanelHeader({
  title,
  subtitle,
  onClose,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-base px-5 py-4">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
        {subtitle ? (
          <div className="mt-0.5 text-sm text-ink-muted">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-muted"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
