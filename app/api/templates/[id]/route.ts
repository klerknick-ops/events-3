import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const template = await prisma.eventTemplate.findFirst({
    where: { id, organizationId: orgId },
    include: {
      slots: {
        orderBy: { sortOrder: "asc" },
        include: { space: true, products: { include: { product: true } } },
      },
      products: { include: { product: true } },
      tasks: { orderBy: { sortOrder: "asc" }, include: { taskTemplate: true } },
    },
  });
  if (!template) return notFound("Template not found");
  return ok(template);
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
  // Index into the slots array this product belongs to (null = template-level).
  slotIndex: z.coerce.number().int().min(0).nullish(),
});
const taskSchema = z.object({ taskTemplateId: z.string() });

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
  archived: z.boolean().optional(),
  slots: z.array(slotSchema).optional(),
  products: z.array(productSchema).optional(),
  tasks: z.array(taskSchema).optional(),
});

// Replace nested collections wholesale when provided.
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.eventTemplate.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Template not found");
  const body = await parseBody(req, schema);

  const template = await prisma.$transaction(async (tx) => {
    await tx.eventTemplate.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description ?? undefined,
        archived: body.archived,
      },
    });

    // Recreate slots one-by-one so we capture their ids for per-slot products.
    let slotIds: string[] = [];
    if (body.slots) {
      await tx.templateSlot.deleteMany({ where: { templateId: id } });
      slotIds = [];
      for (let i = 0; i < body.slots.length; i++) {
        const s = body.slots[i];
        const created = await tx.templateSlot.create({
          data: {
            templateId: id,
            spaceId: s.spaceId || null,
            label: s.label || null,
            startTime: s.startTime,
            durationMin: s.durationMin,
            dayOffset: s.dayOffset ?? 0,
            sortOrder: i,
          },
        });
        slotIds.push(created.id);
      }
    } else {
      const existing = await tx.templateSlot.findMany({
        where: { templateId: id },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      slotIds = existing.map((s) => s.id);
    }
    if (body.products) {
      await tx.templateProduct.deleteMany({ where: { templateId: id } });
      await tx.templateProduct.createMany({
        data: body.products.map((p) => ({
          templateId: id,
          templateSlotId:
            p.slotIndex != null && slotIds[p.slotIndex] ? slotIds[p.slotIndex] : null,
          productId: p.productId,
          quantity: p.quantity,
        })),
      });
    }
    if (body.tasks) {
      await tx.templateTask.deleteMany({ where: { templateId: id } });
      await tx.templateTask.createMany({
        data: body.tasks.map((t, i) => ({
          templateId: id,
          taskTemplateId: t.taskTemplateId,
          sortOrder: i,
        })),
      });
    }

    return tx.eventTemplate.findUnique({
      where: { id },
      include: {
        slots: {
          orderBy: { sortOrder: "asc" },
          include: { space: true, products: { include: { product: true } } },
        },
        products: { include: { product: true } },
        tasks: { orderBy: { sortOrder: "asc" }, include: { taskTemplate: true } },
      },
    });
  });

  return ok(template);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.eventTemplate.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return notFound("Template not found");
  const inUse = await prisma.event.count({ where: { templateId: id } });
  if (inUse > 0) {
    const t = await prisma.eventTemplate.update({
      where: { id },
      data: { archived: true },
    });
    return ok({ archived: true, template: t });
  }
  await prisma.eventTemplate.delete({ where: { id } });
  return ok({ deleted: true });
});
