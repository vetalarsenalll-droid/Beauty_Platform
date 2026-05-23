import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId, type SiteBlock } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { SVP001ContentPanel } from "./content-panel";
import { SVP001Drawers } from "./drawers";
import { SVP001SettingsPanel } from "./settings-panel";

export const SVP001 = {
  blockCode: "SVP001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.serviceProfile ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "serviceProfile",
      variant: "v1",
      data: {
        ...base,
        title: typeof base.title === "string" ? base.title : accountName,
        style: { ...defaultBlockStyle, ...baseStyle },
      },
    } satisfies SiteBlock;
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <SVP001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <SVP001SettingsPanel {...ctx} />,
  drawers: (ctx) => <SVP001Drawers {...ctx} />,
  actions: () => {},
} satisfies BlockVersion;
