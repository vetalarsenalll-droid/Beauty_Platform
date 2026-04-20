import type { CrmPanelCtx } from "../../runtime/contracts";
import { MenuDrawers } from "../ME001/drawers";

export function MenuV3Drawers(ctx: CrmPanelCtx) {
  return <MenuDrawers {...ctx} />;
}

