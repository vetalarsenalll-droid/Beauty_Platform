import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { MENU_PAGE_KEYS, defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { MenuV2ContentPanel } from "./content-panel";
import { MenuV2SettingsPanel } from "./settings-panel";
import { MenuV2Drawers } from "./drawers";

export const ME002: BlockVersion = {
  blockCode: "ME002",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.menu ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "menu",
      variant: "v2",
      data: {
        ...base,
        accountTitle: accountName,
        menuItems: [...MENU_PAGE_KEYS],
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
  contentPanel: (ctx) => <MenuV2ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <MenuV2SettingsPanel {...ctx} />,
  drawers: (ctx) => <MenuV2Drawers {...ctx} />,
  actions: () => {},
};
