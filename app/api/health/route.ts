import { prisma } from "@/lib/db";

// Lightweight health check for Railway/loadbalancers. Verifies the app is up
// and the database is reachable. Public (see middleware allowlist).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "up" });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
