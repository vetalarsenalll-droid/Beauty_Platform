import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { IM001ContentPanel } from "./content-panel";
import { IM001Drawers } from "./drawers";

const base = makeGenericVersion("IM001", "image", "v1");

export const IM001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <IM001ContentPanel {...ctx} />,
  drawers: (ctx) => <IM001Drawers {...ctx} />,
};
