import { prisma } from "@/lib/db";
import { notFound, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { getObject } from "@/lib/storage";

// Serve an email attachment (org-scoped, auth-gated). ?download=1 forces a
// download disposition; otherwise it renders inline where the browser can.
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { orgId } = await requireOrgPermission("VIEW_GLOBAL_ACTIVITY");
  const { id } = await ctx.params;
  const att = await prisma.emailAttachment.findFirst({
    where: { id, email: { organizationId: orgId } },
  });
  if (!att || !att.storageKey) return notFound("Attachment not found");

  const obj = await getObject(att.storageKey);
  if (!obj) return notFound("Attachment bytes not found");

  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": att.contentType || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${att.filename.replace(/"/g, "")}"`,
    },
  });
});
