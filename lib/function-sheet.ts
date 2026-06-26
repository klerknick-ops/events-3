import type { FullEvent } from "./event-include";
import { computeEventTotals, computeRoomTotals } from "./event-helpers";
import { EVENT_STATUS_LABELS, type EventStatus } from "./enums";
import { formatDateLong, formatDateTimeRange } from "./dates";
import { formatMoney, sumTotals, type LineTax, type Totals } from "./money";

// Normalized, format-agnostic representation of a function sheet. Both the PDF
// and DOCX generators consume this so the two stay consistent.
// Optional diff tag set by lib/doc-version when "highlight updates" is on.
export type LineChange = "added" | "modified" | "removed";

export interface FunctionSheetLine {
  title: string;
  quantity: number;
  unitNet: number;
  taxRate: number;
  net: number;
  taxAmount: number;
  gross: number;
  note?: string | null;
  changed?: LineChange;
}

export interface FunctionSheetGroup {
  label: string;
  lines: FunctionSheetLine[];
}

export interface FunctionSheetRoomLine {
  title: string;
  quantity: number;
  nights: number;
  range: string;
  unitNet: number;
  taxRate: number;
  gross: number;
  changed?: LineChange;
}

export interface FunctionSheetData {
  title: string;
  statusLabel: string;
  generatedAt: string;
  client: {
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  slots: { label: string; range: string; note?: string | null; changed?: boolean }[];
  groups: FunctionSheetGroup[];
  rooms: FunctionSheetRoomLine[];
  roomTotals: Totals;
  productTotals: Totals;
  totals: Totals; // grand total (products + rooms)
  totalsChanged?: boolean; // set by lib/doc-version when "highlight updates" is on
  notes: string | null;
  fmt: (n: number) => string;
}

// Build the sheet data. When `dayId` is given, only that day's slots/products/
// rooms are included (per-day export); otherwise the whole event is included.
export function buildFunctionSheet(
  event: FullEvent,
  dayId?: string | null,
): FunctionSheetData {
  const day = dayId ? event.days.find((d) => d.id === dayId) ?? null : null;

  // Filter to the chosen day, if any.
  const slotsForScope = day
    ? event.timeSlots.filter((s) => s.dayId === day.id)
    : event.timeSlots;
  const productsForScope = day
    ? event.products.filter((p) => p.dayId === day.id)
    : event.products;
  const roomsForScope = day
    ? event.roomBookings.filter(
        (b) =>
          new Date(b.checkIn) <= endOfYmd(day.date) &&
          new Date(b.checkOut) > startOfYmd(day.date),
      )
    : event.roomBookings;

  const { lines } = computeEventTotals(productsForScope);

  // Group lines by slot, preserving slot order then a final "whole event" group.
  const slotOrder = [...slotsForScope].sort((a, b) => a.sortOrder - b.sortOrder);
  const groups: FunctionSheetGroup[] = [];

  const bySlot = new Map<string | null, FunctionSheetLine[]>();
  for (const l of lines) {
    const arr = bySlot.get(l.slotId) ?? [];
    arr.push({
      title: l.title,
      quantity: l.quantity,
      unitNet: l.unitNet,
      taxRate: l.taxRate,
      net: l.totals.net,
      taxAmount: l.totals.taxAmount,
      gross: l.totals.gross,
      note: l.note,
    });
    bySlot.set(l.slotId, arr);
  }

  for (const slot of slotOrder) {
    const ls = bySlot.get(slot.id);
    if (ls && ls.length) {
      groups.push({ label: slot.label || slot.space.name, lines: ls });
    }
  }
  const unscoped = [...bySlot.entries()]
    .filter(([k]) => k === null || !slotOrder.some((s) => s.id === k))
    .flatMap(([, v]) => v);
  if (unscoped.length) {
    groups.push({ label: day ? "Other" : "Whole event", lines: unscoped });
  }

  const { lines: roomLines, totals: roomTotals } = computeRoomTotals(roomsForScope);
  const rooms: FunctionSheetRoomLine[] = roomLines.map((r) => ({
    title: r.title,
    quantity: r.quantity,
    nights: r.nights,
    range: `${formatDateLong(r.checkIn)} → ${formatDateLong(r.checkOut)}`,
    unitNet: r.unitNet,
    taxRate: r.taxRate,
    gross: r.totals.gross,
  }));

  const productTotals = computeEventTotals(productsForScope).totals;
  // Grand total = product line taxes + room line taxes.
  const allLineTaxes: LineTax[] = [
    ...computeEventTotals(productsForScope).lines.map((l) => l.totals),
    ...roomLines.map((r) => r.totals),
  ];
  const totals = sumTotals(allLineTaxes);

  const titleSuffix = day ? ` — ${formatDateLong(new Date(day.date))}` : "";

  return {
    title: event.title + titleSuffix,
    statusLabel: EVENT_STATUS_LABELS[event.status as EventStatus] ?? event.status,
    generatedAt: new Date().toLocaleString(),
    client: {
      name: `${event.contact.firstName} ${event.contact.lastName}`,
      company: event.contact.company?.name ?? null,
      email: event.contact.email,
      phone: event.contact.phone,
    },
    slots: slotOrder.map((s) => ({
      label: s.label || s.space.name,
      range: `${s.space.name} — ${formatDateTimeRange(
        new Date(s.startsAt),
        new Date(s.endsAt),
      )}`,
      note: s.notes ?? null,
    })),
    groups,
    rooms,
    roomTotals,
    productTotals,
    totals,
    notes: event.notes,
    fmt: (n: number) => formatMoney(n),
  };
}

function startOfYmd(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfYmd(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
