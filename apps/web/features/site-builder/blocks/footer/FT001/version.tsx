import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { FT001ContentPanel } from "./content-panel";
import { FT001Drawers } from "./drawers";

const base = makeGenericVersion("FT001", "footer", "v1");

export const FT001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <FT001ContentPanel {...ctx} />,
  drawers: (ctx) => <FT001Drawers {...ctx} />,
};
