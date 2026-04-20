import type { CrmPanelCtx } from "../../runtime/contracts";
import { MenuContentPanel } from "../ME001/content-panel";

export function MenuV2ContentPanel(ctx: CrmPanelCtx) {
  return <MenuContentPanel {...ctx} />;
}

