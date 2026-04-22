import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { LoaderContentPanel } from "./content-panel";
import { LoaderSettingsPanel } from "./settings-panel";
import { LoaderDrawers } from "./drawers";

export const LO003: BlockVersion = {
  blockCode: "LO003",
  normalizeData: (input) =>
    typeof input === "object" && input ? (input as Record<string, unknown>) : {},
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.loader ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "loader",
      variant: "v3",
      data: {
        ...base,
        title: typeof base.title === "string" ? base.title : accountName,
        thickness: 3,
        backdropHexDark: "#111827",
        backdropOpacityDark: 0.16,
        backdropColorDark: "rgba(17,24,39,0.16)",
        colorDark: "#111827",
        style: { ...defaultBlockStyle, ...baseStyle },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <LoaderContentPanel {...ctx} />,
  settingsPanel: (ctx) => <LoaderSettingsPanel {...ctx} />,
  drawers: (ctx) => <LoaderDrawers {...ctx} />,
  actions: () => {},
};
