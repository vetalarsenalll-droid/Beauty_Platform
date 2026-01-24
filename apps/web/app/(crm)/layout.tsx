import CrmShell from "./crm/crm-shell";
import { requireCrmSession } from "@/lib/auth";

export default async function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireCrmSession();
  return (
    <CrmShell userEmail={session.email ?? "crm"} permissions={session.permissions}>
      {children}
    </CrmShell>
  );
}
