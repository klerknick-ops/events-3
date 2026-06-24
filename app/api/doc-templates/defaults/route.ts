import { ok, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import {
  DEFAULT_FUNCTION_SHEET_TEMPLATE,
  DEFAULT_PROPOSAL_TEMPLATE,
  DEFAULT_CONFIRMATION_TEMPLATE,
  DEFAULT_PROFORMA_TEMPLATE,
} from "@/lib/doc-template";

export const GET = route(async () => {
  await requireOrgPermission("MANAGE_CONFIG");
  return ok({
    function_sheet: DEFAULT_FUNCTION_SHEET_TEMPLATE,
    proposal: DEFAULT_PROPOSAL_TEMPLATE,
    confirmation: DEFAULT_CONFIRMATION_TEMPLATE,
    proforma: DEFAULT_PROFORMA_TEMPLATE,
  });
});
