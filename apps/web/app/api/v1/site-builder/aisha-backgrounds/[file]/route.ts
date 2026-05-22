import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ file: string }> };

const BACKGROUNDS_DIR = path.join(
  process.cwd(),
  "features",
  "site-builder",
  "blocks",
  "aisha",
  "Fon"
);
const BACKGROUNDS_DIR_FROM_REPO = path.join(process.cwd(), "apps", "web", "features", "site-builder", "blocks", "aisha", "Fon");

const IMAGE_RE = /^[\p{L}\p{N}_ .-]+\.(jpg|jpeg|png|webp|gif|avif)$/iu;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export async function GET(_request: Request, { params }: Params) {
  const { file: rawFile } = await params;
  const file = decodeURIComponent(rawFile);
  if (!IMAGE_RE.test(file)) {
    return new NextResponse("not found", { status: 404 });
  }

  const baseDir = path.isAbsolute(BACKGROUNDS_DIR) ? BACKGROUNDS_DIR : path.resolve(BACKGROUNDS_DIR);
  const repoBaseDir = path.isAbsolute(BACKGROUNDS_DIR_FROM_REPO) ? BACKGROUNDS_DIR_FROM_REPO : path.resolve(BACKGROUNDS_DIR_FROM_REPO);
  let fullPath = path.join(baseDir, file);
  if (path.dirname(fullPath) !== baseDir) {
    return new NextResponse("not found", { status: 404 });
  }

  try {
    let body;
    try {
      body = await readFile(fullPath);
    } catch {
      fullPath = path.join(repoBaseDir, file);
      if (path.dirname(fullPath) !== repoBaseDir) {
        return new NextResponse("not found", { status: 404 });
      }
      body = await readFile(fullPath);
    }
    const ext = path.extname(file).slice(1).toLowerCase();
    return new NextResponse(body, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
