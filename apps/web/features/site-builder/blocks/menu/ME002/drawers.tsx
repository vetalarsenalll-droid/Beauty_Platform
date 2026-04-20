import type { CrmPanelCtx } from "../../runtime/contracts";
import { MenuDrawers } from "../ME001/drawers";

export function MenuV2Drawers(ctx: CrmPanelCtx) {
  return <MenuDrawers {...ctx} />;
}

