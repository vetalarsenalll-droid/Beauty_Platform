import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId, type SiteBlock } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { BO001ContentPanel } from "./content-panel";
import { BO001Drawers } from "./drawers";
import { BO001SettingsPanel } from "./settings-panel";

export const BO001 = {
  blockCode: "BO001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.booking ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "booking",
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
  contentPanel: (ctx) => <BO001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <BO001SettingsPanel {...ctx} />,
  drawers: (ctx) => <BO001Drawers {...ctx} />,
  actions: () => {},
} satisfies BlockVersion;
