import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { FO001ContentPanel } from "./content-panel";
import { FO001Drawers } from "./drawers";

const base = makeGenericVersion("FO001", "form", "v1");

export const FO001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <FO001ContentPanel {...ctx} />,
  drawers: (ctx) => <FO001Drawers {...ctx} />,
};
