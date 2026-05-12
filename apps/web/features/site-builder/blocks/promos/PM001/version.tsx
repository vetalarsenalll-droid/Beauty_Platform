import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { PM001ContentPanel } from "./content-panel";
import { PM001Drawers } from "./drawers";

const base = makeGenericVersion("PM001", "promos", "v1");

export const PM001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <PM001ContentPanel {...ctx} />,
  drawers: (ctx) => <PM001Drawers {...ctx} />,
};
