import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { GA001ContentPanel } from "./content-panel";
import { GA001Drawers } from "./drawers";

const base = makeGenericVersion("GA001", "gallery", "v1");

export const GA001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <GA001ContentPanel {...ctx} />,
  drawers: (ctx) => <GA001Drawers {...ctx} />,
};
