import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { AI001ContentPanel } from "./content-panel";
import { AI001Drawers } from "./drawers";
import { AI001SettingsPanel } from "./settings-panel";

const base = makeGenericVersion("AI001", "aisha", "v1");

export const AI001 = {
  ...base,
  contentPanel: (ctx) => <AI001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <AI001SettingsPanel {...ctx} />,
  drawers: (ctx) => <AI001Drawers {...ctx} />,
} satisfies BlockVersion;
