import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { ClientCabinetContentPanel } from "./content-panel";
import { ClientCabinetSettingsPanel } from "./settings-panel";
import { ClientCabinetSettingsDrawer } from "./settings-drawer";

export const CLC001: BlockVersion = {
  blockCode: "CLC001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: () => {
    const base = (defaultBlockData.clientCabinet ?? defaultBlockData.client ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "clientCabinet",
      variant: "v1",
      data: {
        ...base,
        clientView: "cabinet",
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
        },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <ClientCabinetContentPanel {...ctx} />,
  settingsPanel: (ctx) => <ClientCabinetSettingsPanel {...ctx} />,
  drawers: (ctx) => <ClientCabinetSettingsDrawer {...ctx} />,
  actions: () => {},
};
