import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { PR001ContentPanel } from "./content-panel";
import { PR001Drawers } from "./drawers";

const base = makeGenericVersion("PR001", "project", "v1");

export const PR001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <PR001ContentPanel {...ctx} />,
  drawers: (ctx) => <PR001Drawers {...ctx} />,
};
