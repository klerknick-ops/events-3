import { prisma } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireOrg } from "@/lib/tenant";

// Cross-event task list for the dashboard (scoped to the caller's org).
export const GET = route(async (req) => {
  const { orgId } = await requireOrg();
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // "open" | "done" | "all"
  const tasks = await prisma.task.findMany({
    where: {
      event: { organizationId: orgId },
      ...(status === "done"
        ? { completed: true }
        : status === "all"
          ? {}
          : { completed: false }),
    },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
    include: {
      event: {
        select: {
          id: true,
          title: true,
          status: true,
          contact: {
            select: {
              firstName: true,
              lastName: true,
              company: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  return ok(tasks);
});
