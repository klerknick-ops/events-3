import { notFound, ok, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/tenant";
import { listDocVersions, type DocKind } from "@/lib/render-doc";

const KINDS: DocKind[] = ["function_sheet", "proposal", "confirmation", "proforma"];

// Version history per document type for an event: { [kind]: [{version, generatedAt}] }
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  const event = await prisma.event.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!event) return notFound("Event not found");

  const entries = await Promise.all(
    KINDS.map(async (kind) => [kind, await listDocVersions(id, kind)] as const),
  );
  return ok(Object.fromEntries(entries));
});
