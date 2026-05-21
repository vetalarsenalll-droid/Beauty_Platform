import { unlink } from "node:fs/promises";
import path from "node:path";

export async function removeLocalUploadIfPresent(assetUrl: string | null | undefined) {
  const url = String(assetUrl ?? "").trim();
  if (!url.startsWith("/uploads/")) return;

  const rel = url.replace(/^\//, "");
  const candidate = path.join(process.cwd(), "public", rel);
  const uploadsRoot = path.join(process.cwd(), "public", "uploads") + path.sep;
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(path.resolve(uploadsRoot))) return;

  await unlink(resolved).catch(() => undefined);
}
