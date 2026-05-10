import type { SiteBlock } from "@/lib/site-builder";
import type { BlockCode } from "./contracts";

export function resolveBlockCode(block: SiteBlock): BlockCode {
  if (block.type === "menu") {
    if (block.variant === "v2") return "ME002";
    if (block.variant === "v3") return "ME003";
    return "ME001";
  }
  if (block.type === "cover") {
    if (block.variant === "v3") return "HE003";
    if (block.variant === "v2") return "HE002";
    return "HE001";
  }
  if (block.type === "loader") {
    if (block.variant === "v2") return "LO002";
    if (block.variant === "v3") return "LO003";
    return "LO001";
  }
  if (block.type === "locations") {
    return "LC001";
  }
  if (block.type === "services") {
    return "SE001";
  }
  if (block.type === "specialists") {
    return "SP001";
  }
  if (block.type === "booking") return "BO001";
  if (block.type === "aisha") return "AI001";
  if (block.type === "heading") return "HD001";
  if (block.type === "text") return "TX001";
  if (block.type === "image") return "IM001";
  if (block.type === "gallery") return "GA001";
  if (block.type === "form") return "FO001";
  if (block.type === "button") return "BT001";
  if (block.type === "advantages") return "AD001";
  if (block.type === "project") return "PR001";
  if (block.type === "footer") return "FT001";
  if (block.type === "team") return "TM001";
  if (block.type === "news") return "NW001";
  if (block.type === "widget") return "WG001";
  if (block.type === "locationProfile") return "LP001";
  if (block.type === "serviceProfile") return "SVP001";
  if (block.type === "specialistProfile") return "SPP001";
  return "GEN001";
}
