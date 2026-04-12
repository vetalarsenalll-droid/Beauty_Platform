import { BLOCK_LABELS, BLOCK_VARIANTS, type BlockType } from "@/lib/site-builder";

export type BlockRegistryItem = {
  type: BlockType;
  quickAdd: boolean;
  availableInLibrary: boolean;
};

export const BLOCK_REGISTRY: BlockRegistryItem[] = [
  { type: "cover", quickAdd: true, availableInLibrary: true },
  { type: "menu", quickAdd: false, availableInLibrary: true },
  { type: "loader", quickAdd: false, availableInLibrary: true },
  { type: "aisha", quickAdd: false, availableInLibrary: true },
  { type: "booking", quickAdd: false, availableInLibrary: false },
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

export const QUICK_ADD_BLOCK_TYPES: BlockType[] = BLOCK_REGISTRY
  .filter((item) => item.quickAdd)
  .map((item) => item.type);

export const LIBRARY_BLOCK_TYPES: BlockType[] = BLOCK_REGISTRY
  .filter((item) => item.availableInLibrary)
  .map((item) => item.type);

export function getBlockLabel(type: BlockType): string {
  return BLOCK_LABELS[type];
}

export function getBlockVariants(type: BlockType): Array<"v1" | "v2" | "v3" | "v4" | "v5"> {
  return BLOCK_VARIANTS[type] ?? ["v1"];
}
