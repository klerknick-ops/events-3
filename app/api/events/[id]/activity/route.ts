import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrg, getEventInOrg } from "@/lib/tenant";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { orgId } = await requireOrg();
  const { id } = await ctx.params;
  await getEventInOrg(id, orgId);
  const entries = await prisma.activityLog.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
  return ok(entries);
});
