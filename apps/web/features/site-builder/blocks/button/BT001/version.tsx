import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { BT001ContentPanel } from "./content-panel";
import { BT001Drawers } from "./drawers";

const base = makeGenericVersion("BT001", "button", "v1");

export const BT001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <BT001ContentPanel {...ctx} />,
  drawers: (ctx) => <BT001Drawers {...ctx} />,
};
