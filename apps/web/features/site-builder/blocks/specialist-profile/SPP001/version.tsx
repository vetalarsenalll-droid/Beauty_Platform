import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { SPP001ContentPanel } from "./content-panel";
import { SPP001Drawers } from "./drawers";

const base = makeGenericVersion("SPP001", "specialistProfile", "v1");

export const SPP001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <SPP001ContentPanel {...ctx} />,
  drawers: (ctx) => <SPP001Drawers {...ctx} />,
};
