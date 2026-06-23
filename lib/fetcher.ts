// Tiny typed fetch wrapper for client components.

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function handle<T>(res: Response): Promise<T> {
  // Session expired / not authenticated → bounce to login (browser only).
  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    window.location.pathname !== "/login"
  ) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : undefined;
  if (!res.ok) {
    throw new ApiError(
      (data && (data.error as string)) || res.statusText,
      res.status,
      data?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => fetch(url).then((r) => handle<T>(r)),
  post: <T>(url: string, body?: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then((r) => handle<T>(r)),
  patch: <T>(url: string, body?: unknown) =>
    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then((r) => handle<T>(r)),
  put: <T>(url: string, body?: unknown) =>
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then((r) => handle<T>(r)),
  del: <T>(url: string) =>
    fetch(url, { method: "DELETE" }).then((r) => handle<T>(r)),
  // Multipart (used for product image uploads).
  form: <T>(url: string, form: FormData, method: "POST" | "PATCH" = "POST") =>
    fetch(url, { method, body: form }).then((r) => handle<T>(r)),
};
