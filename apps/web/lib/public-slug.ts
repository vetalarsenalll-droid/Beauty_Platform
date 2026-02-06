export type PublicSlugId = {
  slug: string;
  id: number;
};

export function parsePublicSlugId(value: string | null | undefined): PublicSlugId | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(.*)_([0-9]+)$/.exec(trimmed);
  if (!match) return null;
  const slug = match[1]?.trim();
  const id = Number(match[2]);
  if (!slug || !Number.isInteger(id) || id <= 0) return null;
  return { slug, id };
}

export function buildPublicSlugId(slug: string, id: number) {
  return `${slug}_${id}`;
}
