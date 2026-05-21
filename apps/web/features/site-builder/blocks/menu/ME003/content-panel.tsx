import type { CrmPanelCtx } from "../../runtime/contracts";
import { SharedMenuContentPanel } from "../shared-content-panel";

export function MenuV3ContentPanel(ctx: CrmPanelCtx) {
  return <SharedMenuContentPanel {...ctx} />;
}
