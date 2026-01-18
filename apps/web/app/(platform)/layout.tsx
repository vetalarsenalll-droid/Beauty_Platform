import PlatformShell from "./platform/platform-shell";
import { requirePlatformSession } from "@/lib/auth";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requirePlatformSession();

  return (
    <PlatformShell
      userEmail={session.email ?? "admin"}
      permissions={session.permissions}
    >
      {children}
    </PlatformShell>
  );
}
