import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { BO001Drawers } from "./drawers";
import { BO001SettingsPanel } from "./settings-panel";

const base = makeGenericVersion("BO001", "booking", "v1");

export const BO001 = {
  ...base,
  settingsPanel: (ctx) => <BO001SettingsPanel {...ctx} />,
  drawers: (ctx) => <BO001Drawers {...ctx} />,
} satisfies BlockVersion;
