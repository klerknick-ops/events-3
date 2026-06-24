import { prisma } from "@/lib/db";
import { notFound, route, badRequest } from "@/lib/api";
import { fullEventInclude } from "@/lib/event-include";
import { renderEventDoc, type DocFormat } from "@/lib/render-doc";
import { requireOrg } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";

export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "pdf").toLowerCase();
  const dayId = url.searchParams.get("day");
  if (format !== "pdf" && format !== "docx") {
    return badRequest("Unsupported format. Use ?format=pdf or ?format=docx");
  }

  const event = await prisma.event.findFirst({
    where: { id, organizationId: orgId },
    include: fullEventInclude,
  });
  if (!event) return notFound("Event not found");

  const doc = await renderEventDoc(event, {
    kind: "confirmation",
    format: format as DocFormat,
    dayId,
  });

  await logActivity({
    eventId: id,
    organizationId: orgId,
    userId: user.id,
    action: "DOC_GENERATED",
    summary: `Generated Confirmation (${format.toUpperCase()})`,
  });

  return new Response(new Uint8Array(doc.buffer), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${doc.filename}"`,
    },
  });
});
