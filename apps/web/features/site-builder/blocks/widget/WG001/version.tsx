import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { WG001ContentPanel } from "./content-panel";
import { WG001Drawers } from "./drawers";

const base = makeGenericVersion("WG001", "widget", "v1");

export const WG001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <WG001ContentPanel {...ctx} />,
  drawers: (ctx) => <WG001Drawers {...ctx} />,
};
