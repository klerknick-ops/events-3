import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Pure password hashing (scrypt) with no framework imports, so it can be used
// from the seed script as well as server code.

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const hashBuf = scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  return keyBuf.length === hashBuf.length && timingSafeEqual(hashBuf, keyBuf);
}
