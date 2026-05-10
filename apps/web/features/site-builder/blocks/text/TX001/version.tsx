import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { TX001ContentPanel } from "./content-panel";
import { TX001Drawers } from "./drawers";

const base = makeGenericVersion("TX001", "text", "v1");

export const TX001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <TX001ContentPanel {...ctx} />,
  drawers: (ctx) => <TX001Drawers {...ctx} />,
};
