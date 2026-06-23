import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Cloud object storage for images. Production uses Cloudflare R2 (S3-compatible)
// via the env vars below. When R2 isn't configured (local dev), a filesystem
// driver under .data/uploads is used purely for convenience — production is
// always R2 / object storage, never local disk.
//
// To move to Azure Blob later, add an Azure driver implementing the same
// StoredFile / getObject contract and select it here; nothing else changes.

const R2_BUCKET = process.env.R2_BUCKET || "";
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const useR2 = Boolean(
  R2_BUCKET &&
    R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY,
);

export interface StoredFile {
  url: string; // URL usable in <img src>
  key: string; // storage object key
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");

function safeExt(filename: string, fallback = "png"): string {
  const ext = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
  return ext ? ext.replace(/^\./, "") : fallback;
}

// Public URL for a key: direct R2 public domain if configured, else the app's
// authenticated /api/files proxy (works for both R2 and local dev).
function urlForKey(key: string): string {
  if (useR2 && R2_PUBLIC_BASE_URL) return `${R2_PUBLIC_BASE_URL}/${key}`;
  return `/api/files/${key}`;
}

export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/api/files/")) return url.slice("/api/files/".length);
  if (R2_PUBLIC_BASE_URL && url.startsWith(R2_PUBLIC_BASE_URL + "/")) {
    return url.slice(R2_PUBLIC_BASE_URL.length + 1);
  }
  return null;
}

// Save an uploaded image. `prefix` namespaces the key (e.g. an organization id)
// so tenants' objects are partitioned.
export async function saveImage(
  file: File,
  originalName: string,
  prefix = "shared",
): Promise<StoredFile> {
  const ext = safeExt(originalName);
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  if (useR2) {
    await client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  } else {
    const full = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
  }

  return { url: urlForKey(key), key };
}

export async function deleteImage(url: string | null | undefined): Promise<void> {
  const key = keyFromUrl(url);
  if (!key) return;
  try {
    if (useR2) {
      await client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } else {
      await fs.unlink(path.join(LOCAL_DIR, key));
    }
  } catch {
    // ignore missing objects
  }
}

// Fetch an object's bytes + content type for the /api/files proxy.
export async function getObject(
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    if (useR2) {
      const res = await client().send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
      );
      const bytes = await res.Body!.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: res.ContentType || "application/octet-stream",
      };
    }
    const full = path.join(LOCAL_DIR, key);
    const body = await fs.readFile(full);
    const ext = path.extname(full).slice(1).toLowerCase();
    const map: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    return { body, contentType: map[ext] || "application/octet-stream" };
  } catch {
    return null;
  }
}

export const storageDriver = useR2 ? "r2" : "local";
