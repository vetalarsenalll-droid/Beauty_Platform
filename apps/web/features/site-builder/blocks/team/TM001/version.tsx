import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { TM001ContentPanel } from "./content-panel";
import { TM001Drawers } from "./drawers";

const base = makeGenericVersion("TM001", "team", "v1");

export const TM001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <TM001ContentPanel {...ctx} />,
  drawers: (ctx) => <TM001Drawers {...ctx} />,
};
