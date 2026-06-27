import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseBody, route } from "@/lib/api";
import { requireOrg, requireOrgPermission } from "@/lib/tenant";
import { STARTER_SIGNATURE, type SignatureBlock } from "@/lib/signature";

const SETTING_KEY = "email_signature";

// Load the org's signature block definition (or the starter template if none).
export const GET = route(async () => {
  const { orgId } = await requireOrg();
  const row = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId: orgId, key: SETTING_KEY } },
  });
  let blocks: SignatureBlock[];
  if (row?.value) {
    try {
      blocks = JSON.parse(row.value) as SignatureBlock[];
    } catch {
      blocks = STARTER_SIGNATURE;
    }
  } else {
    blocks = STARTER_SIGNATURE;
  }
  return ok({ blocks, customized: Boolean(row) });
});

// Blocks are validated loosely (the editor owns the shape); we just require a
// known `type` per block so we never persist arbitrary junk.
const blockSchema = z
  .object({ type: z.enum(["text", "image", "links", "social", "banner"]) })
  .passthrough();
const schema = z.object({ blocks: z.array(blockSchema) });

export const PUT = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const body = await parseBody(req, schema);
  await prisma.setting.upsert({
    where: { organizationId_key: { organizationId: orgId, key: SETTING_KEY } },
    create: { organizationId: orgId, key: SETTING_KEY, value: JSON.stringify(body.blocks) },
    update: { value: JSON.stringify(body.blocks) },
  });
  return ok({ saved: true });
});
