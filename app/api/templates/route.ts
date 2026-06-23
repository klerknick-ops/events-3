import { z } from "zod";
import { prisma } from "@/lib/db";
import { created, ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const templates = await prisma.eventTemplate.findMany({
    where: { organizationId: orgId, ...(includeArchived ? {} : { archived: false }) },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { slots: true, products: true, tasks: true } },
    },
  });
  return ok(templates);
});

const slotSchema = z.object({
  spaceId: z.string().nullish(),
  label: z.string().nullish(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.coerce.number().int().positive(),
  dayOffset: z.coerce.number().int().min(0).default(0),
});
const productSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().positive().default(1),
});
const taskSchema = z.object({ taskTemplateId: z.string() });

const schema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  slots: z.array(slotSchema).default([]),
  products: z.array(productSchema).default([]),
  tasks: z.array(taskSchema).default([]),
});

export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  const template = await prisma.eventTemplate.create({
    data: {
      organizationId: orgId,
      name: body.name,
      description: body.description || null,
      slots: {
        create: body.slots.map((s, i) => ({
          spaceId: s.spaceId || null,
          label: s.label || null,
          startTime: s.startTime,
          durationMin: s.durationMin,
          dayOffset: s.dayOffset ?? 0,
          sortOrder: i,
        })),
      },
      products: {
        create: body.products.map((p) => ({
          productId: p.productId,
          quantity: p.quantity,
        })),
      },
      tasks: {
        create: body.tasks.map((t, i) => ({
          taskTemplateId: t.taskTemplateId,
          sortOrder: i,
        })),
      },
    },
    include: { slots: true, products: true, tasks: true },
  });
  return created(template);
});
