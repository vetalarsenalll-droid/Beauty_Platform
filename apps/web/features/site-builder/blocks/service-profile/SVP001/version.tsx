import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { SVP001ContentPanel } from "./content-panel";
import { SVP001Drawers } from "./drawers";

const base = makeGenericVersion("SVP001", "serviceProfile", "v1");

export const SVP001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <SVP001ContentPanel {...ctx} />,
  drawers: (ctx) => <SVP001Drawers {...ctx} />,
};
