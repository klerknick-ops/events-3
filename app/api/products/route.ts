import { prisma } from "@/lib/db";
import { badRequest, created, ok, route } from "@/lib/api";
import { saveImage } from "@/lib/storage";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";

export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const q = url.searchParams.get("q")?.trim();
  const products = await prisma.product.findMany({
    where: {
      organizationId: orgId,
      ...(includeArchived ? {} : { archived: false }),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { title: "asc" },
  });
  return ok(products);
});

// Accepts multipart/form-data (with optional image file) or JSON.
export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const ct = req.headers.get("content-type") || "";
  let title = "";
  let description: string | null = null;
  let priceNet = 0;
  let taxRate = 0;
  let imageUrl: string | null = null;
  let productType = "EVENT";

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    title = String(form.get("title") || "").trim();
    description = (form.get("description") as string)?.trim() || null;
    priceNet = Number(form.get("priceNet") || 0);
    taxRate = Number(form.get("taxRate") || 0);
    productType = String(form.get("productType") || "EVENT");
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      const stored = await saveImage(image, image.name, orgId);
      imageUrl = stored.url;
    }
  } else {
    const body = await req.json();
    title = String(body.title || "").trim();
    description = body.description ?? null;
    priceNet = Number(body.priceNet || 0);
    taxRate = Number(body.taxRate || 0);
    imageUrl = body.imageUrl ?? null;
    productType = String(body.productType || "EVENT");
  }
  if (productType !== "GUEST" && productType !== "EVENT") productType = "EVENT";

  if (!title) return badRequest("Title is required");
  if (!Number.isFinite(priceNet) || priceNet < 0)
    return badRequest("Price must be a non-negative number");
  if (!Number.isFinite(taxRate) || taxRate < 0)
    return badRequest("Tax rate must be a non-negative number");

  const product = await prisma.product.create({
    data: { organizationId: orgId, title, description, priceNet, taxRate, imageUrl, productType },
  });
  return created(product);
});
