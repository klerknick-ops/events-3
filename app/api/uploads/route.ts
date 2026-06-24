import { badRequest, created, route } from "@/lib/api";
import { requireOrgPermission } from "@/lib/tenant";
import { saveImage } from "@/lib/storage";

// Generic image upload (used by the document template editor's image insertion).
// Returns the served URL + key; stored under the org's storage prefix.
export const POST = route(async (req) => {
  const { orgId } = await requireOrgPermission("MANAGE_CONFIG");
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return badRequest("Expected multipart/form-data");
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return badRequest("No file provided");
  }
  if (!file.type.startsWith("image/")) {
    return badRequest("Only image files are supported");
  }
  const stored = await saveImage(file, file.name, `${orgId}/docs`);
  return created(stored);
});
