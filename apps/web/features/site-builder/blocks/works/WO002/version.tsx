import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { WO002ContentPanel } from "./content-panel";
import { WO002Drawers } from "./drawers";

const base = makeGenericVersion("WO002", "works", "v2");

export const WO002: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <WO002ContentPanel {...ctx} />,
  drawers: (ctx) => <WO002Drawers {...ctx} />,
};
