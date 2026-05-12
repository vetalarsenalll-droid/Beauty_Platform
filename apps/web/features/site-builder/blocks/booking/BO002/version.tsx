import type { BlockVersion } from "../../runtime/contracts";
import { makeGenericVersion } from "../../runtime/ui/generic-version";
import { BO002ContentPanel } from "./content-panel";
import { BO002Drawers } from "./drawers";
import { BO002SettingsPanel } from "./settings-panel";

const base = makeGenericVersion("BO002", "booking", "v2");

export const BO002 = {
  ...base,
  contentPanel: (ctx) => <BO002ContentPanel {...ctx} />,
  settingsPanel: (ctx) => <BO002SettingsPanel {...ctx} />,
  drawers: (ctx) => <BO002Drawers {...ctx} />,
} satisfies BlockVersion;
