export type VerificationMetaTag = {
  name: string;
  content: string;
};

export type VerificationHtmlFile = {
  filename: string;
  content: string;
};

const META_TAG_PATTERN = /<meta\s+[^>]*>/gi;
const ATTRIBUTE_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseVerificationMetaTags(value: string | null | undefined) {
  const source = (value ?? "").trim();
  if (!source) return [];

  const tags: VerificationMetaTag[] = [];
  const metaTags = source.match(META_TAG_PATTERN) ?? [];
  for (const tag of metaTags) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
      attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? "");
    }
    const name = attrs.get("name")?.trim();
    const content = attrs.get("content")?.trim();
    if (name && content) {
      tags.push({ name, content });
    }
  }

  return tags.slice(0, 10);
}

export function normalizeVerificationHtmlFilename(value: string | null | undefined) {
  const filename = (value ?? "").trim();
  if (!filename) return "";
  if (!/^[a-zA-Z0-9._-]+\.html$/.test(filename)) return "";
  if (filename.includes("..") || filename.startsWith(".") || filename.length > 160) {
    return "";
  }
  return filename;
}

export function normalizeVerificationHtmlContent(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, 4096);
}

export function normalizeVerificationHtmlFiles(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const files: VerificationHtmlFile[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const filename = normalizeVerificationHtmlFilename(
      "filename" in item ? item.filename : null
    );
    const content = normalizeVerificationHtmlContent(
      "content" in item ? item.content : null
    );
    if (!filename || !content || seen.has(filename)) continue;
    seen.add(filename);
    files.push({ filename, content });
  }

  return files.slice(0, 10);
}

export function mergeVerificationHtmlFiles(
  files: unknown,
  legacyFilename: string | null | undefined,
  legacyContent: string | null | undefined
) {
  const normalized = normalizeVerificationHtmlFiles(files);
  const legacy = {
    filename: normalizeVerificationHtmlFilename(legacyFilename),
    content: normalizeVerificationHtmlContent(legacyContent),
  };
  if (
    legacy.filename &&
    legacy.content &&
    !normalized.some((item) => item.filename === legacy.filename)
  ) {
    normalized.unshift(legacy);
  }
  return normalized.slice(0, 10);
}
