import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { RV001ContentPanel } from "./content-panel";
import { RV001Drawers } from "./drawers";

const base = makeGenericVersion("RV001", "reviews", "v1");

export const RV001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <RV001ContentPanel {...ctx} />,
  drawers: (ctx) => <RV001Drawers {...ctx} />,
};
