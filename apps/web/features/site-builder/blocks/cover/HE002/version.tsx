import type { BlockVersion } from "../../runtime/contracts";
import { HE001 } from "../HE001/version";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { CoverV2ContentPanel } from "./content-panel";

export const HE002: BlockVersion = {
  ...HE001,
  blockCode: "HE002",
  contentPanel: (ctx) => (
    <div className="px-1 pb-8 pt-1">
      <CoverV2ContentPanel {...ctx} />
    </div>
  ),
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.cover ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "cover",
      variant: "v2",
      data: {
        ...base,
        title: accountName,
        align: "center",
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
          textAlign: "center",
          textAlignHeading: "center",
          textAlignSubheading: "center",
        },
      },
    };
  },
};
