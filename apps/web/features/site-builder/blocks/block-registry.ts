import { BLOCK_LABELS, BLOCK_VARIANTS, type BlockType } from "@/lib/site-builder";

export type BlockRegistryItem = {
  type: BlockType;
  quickAdd: boolean;
  availableInLibrary: boolean;
};

export const BLOCK_REGISTRY: BlockRegistryItem[] = [
  { type: "menu", quickAdd: false, availableInLibrary: true },
  { type: "cover", quickAdd: true, availableInLibrary: true },
  { type: "locations", quickAdd: false, availableInLibrary: true },
  { type: "services", quickAdd: false, availableInLibrary: true },
  { type: "specialists", quickAdd: false, availableInLibrary: true },
  { type: "promos", quickAdd: false, availableInLibrary: true },
  { type: "reviews", quickAdd: false, availableInLibrary: true },
  { type: "works", quickAdd: false, availableInLibrary: true },
  { type: "form", quickAdd: true, availableInLibrary: true },
  { type: "contacts", quickAdd: false, availableInLibrary: true },
  { type: "footer", quickAdd: false, availableInLibrary: true },
  { type: "heading", quickAdd: true, availableInLibrary: true },
  { type: "text", quickAdd: true, availableInLibrary: true },
  { type: "image", quickAdd: true, availableInLibrary: true },
  { type: "button", quickAdd: true, availableInLibrary: true },
  { type: "advantages", quickAdd: true, availableInLibrary: true },
  { type: "team", quickAdd: false, availableInLibrary: true },
  { type: "news", quickAdd: false, availableInLibrary: true },
  { type: "widget", quickAdd: false, availableInLibrary: true },
  { type: "about", quickAdd: false, availableInLibrary: true },
  { type: "aisha", quickAdd: false, availableInLibrary: true },
  { type: "loader", quickAdd: false, availableInLibrary: true },
  { type: "locationProfile", quickAdd: false, availableInLibrary: true },
  { type: "serviceProfile", quickAdd: false, availableInLibrary: true },
  { type: "specialistProfile", quickAdd: false, availableInLibrary: true },
  { type: "booking", quickAdd: false, availableInLibrary: true },
];

const BLOCK_REGISTRY_BY_TYPE = new Map<BlockType, BlockRegistryItem>(
  BLOCK_REGISTRY.map((item) => [item.type, item])
);

export function getBlockRegistryItem(type: BlockType): BlockRegistryItem {
  return (
    BLOCK_REGISTRY_BY_TYPE.get(type) ?? {
      type,
      quickAdd: false,
      availableInLibrary: true,
    }
  );
}

export const QUICK_ADD_BLOCK_TYPES: BlockType[] = [
  "cover",
  "heading",
  "text",
  "image",
  "form",
  "button",
  "advantages",
].filter((type) => getBlockRegistryItem(type).quickAdd);

export const LIBRARY_BLOCK_TYPES: BlockType[] = BLOCK_REGISTRY
  .filter((item) => item.availableInLibrary)
  .map((item) => item.type);

export const PRIMARY_LIBRARY_BLOCK_TYPES = new Set<BlockType>([
  "menu",
  "cover",
  "locations",
  "services",
  "specialists",
  "promos",
  "reviews",
  "works",
  "form",
  "contacts",
  "footer",
]);

export function getBlockLabel(type: BlockType): string {
  return BLOCK_LABELS[type];
}

export function getBlockVariants(type: BlockType): Array<"v1" | "v2" | "v3" | "v4" | "v5"> {
  return BLOCK_VARIANTS[type] ?? ["v1"];
}
