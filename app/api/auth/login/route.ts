import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, ok, parseBody, route } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = route(async (req) => {
  const body = await parseBody(req, schema);
  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase().trim() },
  });
  if (!user || !user.active || !verifyPassword(body.password, user.passwordHash)) {
    return badRequest("Invalid email or password");
  }
  await createSession(user.id);
  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
});
