import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { WO001ContentPanel } from "./content-panel";
import { WO001Drawers } from "./drawers";

const base = makeGenericVersion("WO001", "works", "v1");

export const WO001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <WO001ContentPanel {...ctx} />,
  drawers: (ctx) => <WO001Drawers {...ctx} />,
};
