import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { AB001ContentPanel } from "./content-panel";
import { AB001Drawers } from "./drawers";

const base = makeGenericVersion("AB001", "about", "v1");

export const AB001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <AB001ContentPanel {...ctx} />,
  drawers: (ctx) => <AB001Drawers {...ctx} />,
};
