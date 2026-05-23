import type { CrmPanelCtx } from "../../runtime/contracts";
import { ProfileContentPanel } from "../../profile-shared/content-panel";

export function SVP001ContentPanel(ctx: CrmPanelCtx) {
  return <ProfileContentPanel {...ctx} profileType="serviceProfile" />;
}
