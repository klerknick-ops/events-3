import { getObject } from "@/lib/storage";
import { requireUser } from "@/lib/auth";

// Streams an image object from storage (R2 or local dev driver) by key.
// Requires an authenticated session (middleware already enforces this for /api).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> },
) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { key } = await ctx.params;
  const obj = await getObject(key.join("/"));
  if (!obj) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
