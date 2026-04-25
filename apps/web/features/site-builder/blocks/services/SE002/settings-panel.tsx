import type { CrmPanelCtx } from "../../runtime/contracts";
import { renderGenericSettingsPanel } from "../../runtime/ui/generic-settings-panel";

export function SE002SettingsPanel(ctx: CrmPanelCtx) {
  return <>{renderGenericSettingsPanel(ctx)}</>;
}
