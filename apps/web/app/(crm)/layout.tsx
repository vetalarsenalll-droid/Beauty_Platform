import CrmShell from "./crm/crm-shell";
import { requireCrmSession } from "@/lib/auth";
import {
  buildCrmBillingNotice,
  reconcileAccountSubscriptionState,
} from "@/lib/platform-subscriptions";

export default async function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireCrmSession();
  const subscriptionState = await reconcileAccountSubscriptionState(session.accountId);
  const billingNotice = buildCrmBillingNotice(subscriptionState);

  return (
    <CrmShell
      userEmail={session.email ?? "crm"}
      permissions={session.permissions}
      billingNotice={billingNotice}
    >
      {children}
    </CrmShell>
  );
}
