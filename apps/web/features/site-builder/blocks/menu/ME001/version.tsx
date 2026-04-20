import type { BlockVersion, CrmPanelCtx } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { MenuContentPanel } from "./content-panel";
import { MenuSettingsPanel } from "./settings-panel";
import { MenuDrawers } from "./drawers";

function updateSelected(ctx: CrmPanelCtx, next: unknown) {
  ctx.updateBlock(ctx.block.id, () => next as any);
}

export const ME001: BlockVersion = {
  blockCode: "ME001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.menu ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "menu",
      variant: "v1",
      data: {
        ...base,
        accountTitle: accountName,
        menuItems: ["home", "booking", "client", "locations", "services", "specialists", "promos"],
        menuHeight: 64,
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
  contentPanel: (ctx) => <MenuContentPanel {...ctx} />,
  settingsPanel: (ctx) => <MenuSettingsPanel {...ctx} />,
  drawers: (ctx) => <MenuDrawers {...ctx} />,
  actions: () => {},
};
