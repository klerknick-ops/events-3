import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type infer as zInfer } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function conflict(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 409 });
}

export function serverError(message = "Something went wrong") {
  return NextResponse.json({ error: message }, { status: 500 });
}

// Parse + validate a JSON body against a zod schema, throwing a Response on error.
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<zInfer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
  try {
    return schema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      throw badRequest("Validation failed", e.flatten());
    }
    throw e;
  }
}

// Wrap a route handler so thrown Responses (from parseBody) and unexpected
// errors are converted into JSON responses.
export function route<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<Response>,
) {
  return async (req: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error("[api error]", e);
      return serverError();
    }
  };
}
