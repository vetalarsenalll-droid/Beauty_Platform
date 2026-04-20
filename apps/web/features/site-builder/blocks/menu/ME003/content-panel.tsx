import type { CrmPanelCtx } from "../../runtime/contracts";
import { MenuContentPanel } from "../ME001/content-panel";

export function MenuV3ContentPanel(ctx: CrmPanelCtx) {
  return <MenuContentPanel {...ctx} />;
}

