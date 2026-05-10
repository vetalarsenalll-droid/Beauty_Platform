import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { AD001ContentPanel } from "./content-panel";
import { AD001Drawers } from "./drawers";

const base = makeGenericVersion("AD001", "advantages", "v1");

export const AD001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <AD001ContentPanel {...ctx} />,
  drawers: (ctx) => <AD001Drawers {...ctx} />,
};
