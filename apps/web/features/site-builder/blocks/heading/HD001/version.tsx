import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { HD001ContentPanel } from "./content-panel";
import { HD001Drawers } from "./drawers";

const base = makeGenericVersion("HD001", "heading", "v1");

export const HD001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <HD001ContentPanel {...ctx} />,
  drawers: (ctx) => <HD001Drawers {...ctx} />,
};
