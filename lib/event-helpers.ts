import { lineTotals, sumTotals, type LineTax, type Totals } from "./money";

// Shapes used for totals computation. Kept loose so both Prisma results and
// plain objects can be passed in.
export interface EventProductLike {
  id: string;
  quantity: number;
  nameOverride?: string | null;
  unitPriceNetOverride: number | null;
  taxRateOverride: number | null;
  notes?: string | null;
  slotId: string | null;
  product: {
    id: string;
    title: string;
    priceNet: number;
    taxRate: number;
    imageUrl?: string | null;
    description?: string | null;
  };
}

export interface ComputedLine {
  id: string;
  productId: string;
  title: string;
  quantity: number;
  unitNet: number;
  taxRate: number;
  slotId: string | null;
  note: string | null;
  totals: LineTax;
}

export function computeLine(ep: EventProductLike): ComputedLine {
  const unitNet = ep.unitPriceNetOverride ?? ep.product.priceNet;
  const taxRate = ep.taxRateOverride ?? ep.product.taxRate;
  return {
    id: ep.id,
    productId: ep.product.id,
    // Per-line name override falls back to the catalog product title.
    title: ep.nameOverride?.trim() || ep.product.title,
    quantity: ep.quantity,
    unitNet,
    taxRate,
    slotId: ep.slotId,
    note: ep.notes ?? null,
    totals: lineTotals(unitNet, ep.quantity, taxRate),
  };
}

export function computeEventTotals(products: EventProductLike[]): {
  lines: ComputedLine[];
  totals: Totals;
} {
  const lines = products.map(computeLine);
  const totals = sumTotals(lines.map((l) => l.totals));
  return { lines, totals };
}

// ----- Hotel room bookings -----

export interface RoomBookingLike {
  id: string;
  quantity: number;
  checkIn: string | Date;
  checkOut: string | Date;
  roomType: { id: string; title: string; priceNet: number; taxRate: number };
}

export interface ComputedRoomLine {
  id: string;
  title: string;
  quantity: number;
  nights: number;
  unitNet: number; // per room per night
  taxRate: number;
  checkIn: Date;
  checkOut: Date;
  totals: LineTax;
}

export function nightsCount(checkIn: string | Date, checkOut: string | Date): number {
  const a = new Date(checkIn);
  a.setHours(0, 0, 0, 0);
  const b = new Date(checkOut);
  b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function computeRoomLine(b: RoomBookingLike): ComputedRoomLine {
  const nights = nightsCount(b.checkIn, b.checkOut);
  // One "unit" = a room-night; quantity * nights room-nights at the nightly rate.
  const totals = lineTotals(b.roomType.priceNet, b.quantity * nights, b.roomType.taxRate);
  return {
    id: b.id,
    title: b.roomType.title,
    quantity: b.quantity,
    nights,
    unitNet: b.roomType.priceNet,
    taxRate: b.roomType.taxRate,
    checkIn: new Date(b.checkIn),
    checkOut: new Date(b.checkOut),
    totals,
  };
}

export function computeRoomTotals(bookings: RoomBookingLike[]): {
  lines: ComputedRoomLine[];
  totals: Totals;
} {
  const lines = bookings.map(computeRoomLine);
  const totals = sumTotals(lines.map((l) => l.totals));
  return { lines, totals };
}
