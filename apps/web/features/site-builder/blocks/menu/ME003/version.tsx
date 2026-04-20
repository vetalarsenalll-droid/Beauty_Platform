import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { MenuV3ContentPanel } from "./content-panel";
import { MenuV3SettingsPanel } from "./settings-panel";
import { MenuV3Drawers } from "./drawers";

export const ME003: BlockVersion = {
  blockCode: "ME003",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.menu ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "menu",
      variant: "v3",
      data: {
        ...base,
        accountTitle: accountName,
        menuItems: ["home", "booking", "client", "locations", "services", "specialists", "promos"],
        menuHeight: 56,
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
          borderColorLight: "transparent",
          borderColorDark: "transparent",
          borderColor: "transparent",
        },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <MenuV3ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <MenuV3SettingsPanel {...ctx} />,
  drawers: (ctx) => <MenuV3Drawers {...ctx} />,
  actions: () => {},
};
