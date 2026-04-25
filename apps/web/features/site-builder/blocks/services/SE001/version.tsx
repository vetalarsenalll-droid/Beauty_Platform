import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { SE001ContentPanel } from "./content-panel";
import { SE001SettingsPanel } from "./settings-panel";
import { SE001Drawers } from "./drawers";

export const SE001: BlockVersion = {
  blockCode: "SE001",
  normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
  createDefault: () => {
    const base = (defaultBlockData.services ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "services",
      variant: "v1",
      data: {
        ...base,
        title: "Список услуг",
        subtitle: "Подберите процедуру по категории, стоимости и формату записи.",
        cardsPerRow: 3,
        categoryAllLabel: "Все услуги",
        searchPlaceholder: "Найти услугу",
        style: { ...defaultBlockStyle, ...baseStyle },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <SE001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <SE001SettingsPanel {...ctx} />,
  drawers: (ctx) => <SE001Drawers {...ctx} />,
  actions: () => {},
};
