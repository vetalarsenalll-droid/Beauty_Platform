import type { CrmPanelCtx } from "../../runtime/contracts";
import { MenuSettingsPanel } from "../ME001/settings-panel";

export function MenuV3SettingsPanel(ctx: CrmPanelCtx) {
  return <MenuSettingsPanel {...ctx} />;
}

