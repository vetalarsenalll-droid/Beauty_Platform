import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { LP001ContentPanel } from "./content-panel";
import { LP001Drawers } from "./drawers";

const base = makeGenericVersion("LP001", "locationProfile", "v1");

export const LP001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <LP001ContentPanel {...ctx} />,
  drawers: (ctx) => <LP001Drawers {...ctx} />,
};
