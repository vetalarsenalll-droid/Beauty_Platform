import type { CrmPanelCtx } from "../../runtime/contracts";
import { SharedMenuContentPanel } from "../shared-content-panel";

export function MenuV2ContentPanel(ctx: CrmPanelCtx) {
  return <SharedMenuContentPanel {...ctx} />;
}
