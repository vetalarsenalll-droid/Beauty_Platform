import type { BlockVersion } from "../../runtime/contracts";
import { ME001 } from "../ME001/version";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";

export const ME002: BlockVersion = {
  ...ME001,
  blockCode: "ME002",
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
        menuItems: ["home", "booking"],
        menuHeight: 56,
        style: { ...defaultBlockStyle, ...baseStyle },
      },
    };
  },
};
