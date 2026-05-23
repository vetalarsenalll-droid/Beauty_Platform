import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId, type SiteBlock } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { BO002ContentPanel } from "./content-panel";
import { BO002Drawers } from "./drawers";
import { BO002SettingsPanel } from "./settings-panel";

export const BO002 = {
  blockCode: "BO002",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.booking ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "booking",
      variant: "v2",
      data: {
        ...base,
        title: typeof base.title === "string" ? base.title : accountName,
        style: { ...defaultBlockStyle, ...baseStyle },
      },
    } satisfies SiteBlock;
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <BO002ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <BO002SettingsPanel {...ctx} />,
  drawers: (ctx) => <BO002Drawers {...ctx} />,
  actions: () => {},
} satisfies BlockVersion;
