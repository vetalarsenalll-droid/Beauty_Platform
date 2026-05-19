import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { ClientLoginContentPanel } from "./content-panel";
import { ClientLoginSettingsPanel } from "./settings-panel";
import { ClientLoginSettingsDrawer } from "./settings-drawer";

export const CLL001: BlockVersion = {
  blockCode: "CLL001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: () => {
    const base = (defaultBlockData.clientLogin ?? defaultBlockData.client ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "clientLogin",
      variant: "v1",
      data: {
        ...base,
        clientView: "login",
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
        },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <ClientLoginContentPanel {...ctx} />,
  settingsPanel: (ctx) => <ClientLoginSettingsPanel {...ctx} />,
  drawers: (ctx) => <ClientLoginSettingsDrawer {...ctx} />,
  actions: () => {},
};
