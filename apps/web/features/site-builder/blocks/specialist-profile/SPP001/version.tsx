import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId, type SiteBlock } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { SPP001ContentPanel } from "./content-panel";
import { SPP001Drawers } from "./drawers";
import { SPP001SettingsPanel } from "./settings-panel";

export const SPP001 = {
  blockCode: "SPP001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.specialistProfile ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "specialistProfile",
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
  contentPanel: (ctx) => <SPP001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <SPP001SettingsPanel {...ctx} />,
  drawers: (ctx) => <SPP001Drawers {...ctx} />,
  actions: () => {},
} satisfies BlockVersion;
