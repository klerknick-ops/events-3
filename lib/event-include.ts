import type { Prisma } from "@prisma/client";

// Shared "full event" include used by the detail panel + function sheet.
export const fullEventInclude = {
  contact: { include: { company: true } },
  template: { select: { id: true, name: true } },
  paymentTerms: true,
  assignedUser: { select: { id: true, name: true } },
  days: { orderBy: { sortOrder: "asc" } },
  timeSlots: {
    orderBy: { sortOrder: "asc" },
    include: { space: true, setup: true },
  },
  products: {
    include: { product: true, slot: true },
    orderBy: { id: "asc" },
  },
  roomBookings: { include: { roomType: true }, orderBy: { checkIn: "asc" } },
  tasks: { orderBy: [{ completed: "asc" }, { dueDate: "asc" }] },
} satisfies Prisma.EventInclude;

export type FullEvent = Prisma.EventGetPayload<{ include: typeof fullEventInclude }>;
