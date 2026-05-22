import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const ICONS_DIR = path.join(
  process.cwd(),
  "features",
  "site-builder",
  "blocks",
  "aisha",
  "Icon"
);
const ICONS_DIR_FROM_REPO = path.join(process.cwd(), "apps", "web", "features", "site-builder", "blocks", "aisha", "Icon");

const IMAGE_RE = /^[\p{L}\p{N}_ .-]+\.(svg|jpg|jpeg|png|webp|gif|avif)$/iu;
const ORDER_RE = /(?:^|[^\d])(\d+)(?=\D*\.[^.]+$)/;

export async function GET() {
  try {
    let entries;
    try {
      entries = await readdir(ICONS_DIR, { withFileTypes: true });
    } catch {
      entries = await readdir(ICONS_DIR_FROM_REPO, { withFileTypes: true });
    }
    const items = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        if (!IMAGE_RE.test(entry.name)) return null;
        const orderMatch = ORDER_RE.exec(entry.name);
        const index = orderMatch ? Number(orderMatch[1]) : Number.MAX_SAFE_INTEGER;
        const label = entry.name.replace(/\.[^.]+$/, "");
        return {
          index,
          name: entry.name,
          label,
          url: `/api/v1/site-builder/aisha-icons/${encodeURIComponent(entry.name)}`,
        };
      })
      .filter((item): item is { index: number; name: string; label: string; url: string } => Boolean(item))
      .sort((a, b) => a.index - b.index);

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
