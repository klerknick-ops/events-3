import { prisma } from "@/lib/db";
import { forbidden, notFound, ok, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

// Delete a note. Allowed for the author or any Manager/Admin (within the org).
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user, orgId } = await requireOrg();
  const { id } = await ctx.params;
  const note = await prisma.eventNote.findFirst({
    where: { id, event: { organizationId: orgId } },
  });
  if (!note) return notFound("Note not found");
  if (note.authorId !== user.id && user.role === "STAFF") {
    return forbidden("You can only delete your own notes");
  }
  await prisma.eventNote.delete({ where: { id } });
  return ok({ deleted: true });
});
