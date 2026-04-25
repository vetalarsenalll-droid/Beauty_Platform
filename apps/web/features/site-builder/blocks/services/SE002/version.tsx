import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { SE002ContentPanel } from "./content-panel";
import { SE002SettingsPanel } from "./settings-panel";
import { SE002Drawers } from "./drawers";

export const SE002: BlockVersion = {
  blockCode: "SE002",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: () => {
    const base = (defaultBlockData.services ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "services",
      variant: "v2",
      data: {
        ...base,
        title: "Каталог услуг",
        subtitle: "Структурированный каталог процедур с быстрым поиском и записью.",
        cardsPerRow: 4,
        categoryAllLabel: "Все категории",
        searchPlaceholder: "Поиск по каталогу",
        style: { ...defaultBlockStyle, ...baseStyle },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <SE002ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <SE002SettingsPanel {...ctx} />,
  drawers: (ctx) => <SE002Drawers {...ctx} />,
  actions: () => {},
};
