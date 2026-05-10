import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { NW001ContentPanel } from "./content-panel";
import { NW001Drawers } from "./drawers";

const base = makeGenericVersion("NW001", "news", "v1");

export const NW001: BlockVersion = {
  ...base,
  contentPanel: (ctx) => <NW001ContentPanel {...ctx} />,
  drawers: (ctx) => <NW001Drawers {...ctx} />,
};
