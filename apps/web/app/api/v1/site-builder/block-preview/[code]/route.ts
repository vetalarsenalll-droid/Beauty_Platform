import { readdir, readFile } from "fs/promises";
import path from "path";
import type { BlockCode } from "@/features/site-builder/blocks/runtime/contracts";

type Params = { params: Promise<{ code: string }> };

const BLOCK_PREVIEW_PATHS: Partial<Record<BlockCode, string>> = {
  ME001: "menu/ME001",
  ME002: "menu/ME002",
  ME003: "menu/ME003",
  HE001: "cover/HE001",
  HE002: "cover/HE002",
  HE003: "cover/HE003",
  LO001: "loader/LO001",
  LO002: "loader/LO002",
  LO003: "loader/LO003",
  LC001: "locations/LC001",
  SE001: "services/SE001",
  SP001: "specialists/SP001",
  BO001: "booking/BO001",
  BO002: "booking/BO002",
  AI001: "aisha/AI001",
  AB001: "about/AB001",
  HD001: "heading/HD001",
  TX001: "text/TX001",
  IM001: "image/IM001",
  FO001: "form/FO001",
  BT001: "button/BT001",
  AD001: "advantages/AD001",
  FT001: "footer/FT001",
  TM001: "team/TM001",
  NW001: "news/NW001",
  WG001: "widget/WG001",
  WO001: "works/WO001",
  WO002: "works/WO002",
  RV001: "reviews/RV001",
  CT001: "contacts/CT001",
  PM001: "promos/PM001",
  CLL001: "client-login/CLL001",
  CLC001: "client-cabinet/CLC001",
  LP001: "location-profile/LP001",
  SVP001: "service-profile/SVP001",
  SPP001: "specialist-profile/SPP001",
};

const CONTENT_TYPES: Record<string, string> = {
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
};

function placeholderSvg(code: string) {
  const safeCode = code.replace(/[<>&"]/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 427" role="img" aria-label="${safeCode}">
  <rect width="900" height="427" fill="#f3f4f6"/>
  <rect x="32" y="32" width="836" height="363" fill="#ffffff" stroke="#d9dde5"/>
  <text x="450" y="196" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#111827">${safeCode}</text>
  <text x="450" y="238" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#6b7280">Добавьте изображение ${safeCode} в папку этого блока</text>
</svg>`;
}

export async function GET(_request: Request, { params }: Params) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase() as BlockCode;
  const relativeDir = BLOCK_PREVIEW_PATHS[code];

  if (!relativeDir) {
    return new Response(placeholderSvg(code), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    });
  }

  const dirPath = path.join(process.cwd(), "features", "site-builder", "blocks", relativeDir);

  try {
    const files = await readdir(dirPath);
    const imageFile = files.find((file) => path.parse(file).name.toUpperCase() === code);
    if (!imageFile) throw new Error("Preview image not found");

    const filePath = path.join(dirPath, imageFile);
    const image = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(imageFile).toLowerCase()] ?? "application/octet-stream";
    return new Response(image, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Content-Type": contentType,
      },
    });
  } catch {
    return new Response(placeholderSvg(code), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    });
  }
}
