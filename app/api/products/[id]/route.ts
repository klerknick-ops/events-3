import { prisma } from "@/lib/db";
import { badRequest, ok, route } from "@/lib/api";
import { deleteImage, saveImage } from "@/lib/storage";
import { requireOrgPermission } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const existing = await prisma.product.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) return badRequest("Product not found");

  const ct = req.headers.get("content-type") || "";
  const data: Record<string, unknown> = {};

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    if (form.has("title")) data.title = String(form.get("title")).trim();
    if (form.has("description"))
      data.description = String(form.get("description")).trim() || null;
    if (form.has("priceNet")) data.priceNet = Number(form.get("priceNet"));
    if (form.has("taxRate")) data.taxRate = Number(form.get("taxRate"));
    if (form.has("archived"))
      data.archived = String(form.get("archived")) === "true";
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      const stored = await saveImage(image, image.name, orgId);
      data.imageUrl = stored.url;
      await deleteImage(existing.imageUrl);
    }
  } else {
    const body = await req.json();
    for (const k of ["title", "description", "priceNet", "taxRate", "imageUrl", "archived"]) {
      if (k in body) data[k] = body[k];
    }
  }

  const product = await prisma.product.update({ where: { id }, data });
  return ok(product);
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const { id } = await ctx.params;
  const owned = await prisma.product.findFirst({ where: { id, organizationId: orgId } });
  if (!owned) return badRequest("Product not found");
  const usage = await prisma.eventProduct.count({ where: { productId: id } });
  const inTemplates = await prisma.templateProduct.count({
    where: { productId: id },
  });
  if (usage > 0 || inTemplates > 0) {
    const product = await prisma.product.update({
      where: { id },
      data: { archived: true },
    });
    return ok({ archived: true, product });
  }
  const existing = await prisma.product.findUnique({ where: { id } });
  await prisma.product.delete({ where: { id } });
  await deleteImage(existing?.imageUrl);
  return ok({ deleted: true });
});
