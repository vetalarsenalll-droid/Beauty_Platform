import type { SiteBlock } from "@/lib/site-builder";
import type { BlockCode } from "./contracts";

export function resolveBlockCode(block: SiteBlock): BlockCode {
  if (block.type === "menu") {
    if (block.variant === "v2") return "ME002";
    if (block.variant === "v3") return "ME003";
    return "ME001";
  }
  if (block.type === "cover") {
    if (block.variant === "v2") return "HE002";
    return "HE001";
  }
  if (block.type === "loader") {
    if (block.variant === "v2") return "LO002";
    if (block.variant === "v3") return "LO003";
    return "LO001";
  }
  if (block.type === "booking") return "BO001";
  return "AI001";
}
