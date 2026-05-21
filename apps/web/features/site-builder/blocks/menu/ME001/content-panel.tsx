import type { CrmPanelCtx } from "../../runtime/contracts";
import { SharedMenuContentPanel } from "../shared-content-panel";

export function MenuContentPanel(ctx: CrmPanelCtx) {
  return <SharedMenuContentPanel {...ctx} />;
}
