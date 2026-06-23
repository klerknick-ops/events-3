import { prisma } from "@/lib/db";
import { badRequest, created, ok, route } from "@/lib/api";
import { saveImage } from "@/lib/storage";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const rooms = await prisma.hotelRoomType.findMany({
    where: { organizationId: orgId, ...(includeArchived ? {} : { archived: false }) },
    orderBy: { title: "asc" },
  });
  return ok(rooms);
});

// Accepts multipart/form-data (optional image) or JSON.
export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const ct = req.headers.get("content-type") || "";
  let title = "";
  let description: string | null = null;
  let priceNet = 0;
  let taxRate = 0;
  let inventory = 1;
  let imageUrl: string | null = null;

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    title = String(form.get("title") || "").trim();
    description = (form.get("description") as string)?.trim() || null;
    priceNet = Number(form.get("priceNet") || 0);
    taxRate = Number(form.get("taxRate") || 0);
    inventory = Number(form.get("inventory") || 1);
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      imageUrl = (await saveImage(image, image.name, orgId)).url;
    }
  } else {
    const body = await req.json();
    title = String(body.title || "").trim();
    description = body.description ?? null;
    priceNet = Number(body.priceNet || 0);
    taxRate = Number(body.taxRate || 0);
    inventory = Number(body.inventory ?? 1);
    imageUrl = body.imageUrl ?? null;
  }

  if (!title) return badRequest("Title is required");
  if (!Number.isFinite(priceNet) || priceNet < 0)
    return badRequest("Price must be a non-negative number");
  if (!Number.isFinite(inventory) || inventory < 1)
    return badRequest("Inventory must be at least 1");

  const room = await prisma.hotelRoomType.create({
    data: { organizationId: orgId, title, description, priceNet, taxRate, inventory, imageUrl },
  });
  return created(room);
});
