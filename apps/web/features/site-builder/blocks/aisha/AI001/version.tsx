import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId, type SiteBlock } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { AI001ContentPanel } from "./content-panel";
import { AI001Drawers } from "./drawers";
import { AI001SettingsPanel } from "./settings-panel";

export const AI001 = {
  blockCode: "AI001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.aisha ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "aisha",
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
  contentPanel: (ctx) => <AI001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <AI001SettingsPanel {...ctx} />,
  drawers: (ctx) => <AI001Drawers {...ctx} />,
  actions: () => {},
} satisfies BlockVersion;
