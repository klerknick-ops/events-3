import { ok, route } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import {
  DEFAULT_FUNCTION_SHEET_TEMPLATE,
  DEFAULT_PROPOSAL_TEMPLATE,
} from "@/lib/doc-template";

export const GET = route(async () => {
  await requirePermission("MANAGE_CONFIG");
  return ok({
    function_sheet: DEFAULT_FUNCTION_SHEET_TEMPLATE,
    proposal: DEFAULT_PROPOSAL_TEMPLATE,
  });
});
