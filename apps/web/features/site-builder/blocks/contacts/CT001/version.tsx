import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { CT001ContentPanel } from "./content-panel";
import { CT001Drawers } from "./drawers";

const base = makeGenericVersion("CT001", "contacts", "v1");

export const CT001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <CT001ContentPanel {...ctx} />,
  drawers: (ctx) => <CT001Drawers {...ctx} />,
};
