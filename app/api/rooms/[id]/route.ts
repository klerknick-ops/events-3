import { prisma } from "@/lib/db";
import { badRequest, ok, route } from "@/lib/api";
import { deleteImage, saveImage } from "@/lib/storage";
import { requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const existing = await prisma.hotelRoomType.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) return badRequest("Room type not found");

  const ct = req.headers.get("content-type") || "";
  const data: Record<string, unknown> = {};

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    if (form.has("title")) data.title = String(form.get("title")).trim();
    if (form.has("description"))
      data.description = String(form.get("description")).trim() || null;
    if (form.has("priceNet")) data.priceNet = Number(form.get("priceNet"));
    if (form.has("taxRate")) data.taxRate = Number(form.get("taxRate"));
    if (form.has("inventory")) data.inventory = Number(form.get("inventory"));
    if (form.has("archived"))
      data.archived = String(form.get("archived")) === "true";
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      data.imageUrl = (await saveImage(image, image.name, orgId)).url;
      await deleteImage(existing.imageUrl);
    }
  } else {
    const body = await req.json();
    for (const k of ["title", "description", "priceNet", "taxRate", "inventory", "imageUrl", "archived"]) {
      if (k in body) data[k] = body[k];
    }
  }

  const room = await prisma.hotelRoomType.update({ where: { id }, data });
  return ok(room);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.hotelRoomType.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return badRequest("Room type not found");
  const usage = await prisma.eventRoomBooking.count({ where: { roomTypeId: id } });
  if (usage > 0) {
    const room = await prisma.hotelRoomType.update({
      where: { id },
      data: { archived: true },
    });
    return ok({ archived: true, room });
  }
  const existing = await prisma.hotelRoomType.findUnique({ where: { id } });
  await prisma.hotelRoomType.delete({ where: { id } });
  await deleteImage(existing?.imageUrl);
  return ok({ deleted: true });
});
