import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId, type SiteBlock } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { LP001ContentPanel } from "./content-panel";
import { LP001Drawers } from "./drawers";
import { LP001SettingsPanel } from "./settings-panel";

export const LP001 = {
  blockCode: "LP001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.locationProfile ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "locationProfile",
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
  contentPanel: (ctx) => <LP001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <LP001SettingsPanel {...ctx} />,
  drawers: (ctx) => <LP001Drawers {...ctx} />,
  actions: () => {},
} satisfies BlockVersion;
