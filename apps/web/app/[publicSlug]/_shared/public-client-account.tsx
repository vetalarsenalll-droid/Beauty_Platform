import { ClientHomeContent } from "@/app/c/client-home-content";
import ClientLoginPage from "@/app/c/login/login-client";
import { getClientSession } from "@/lib/auth";

type PublicClientAccountProps = {
  accountSlug: string;
  publicSlug: string;
};

export default async function PublicClientAccount({
  accountSlug,
  publicSlug,
}: PublicClientAccountProps) {
  const session = await getClientSession();
  const returnTo = publicSlug ? `/${publicSlug}/client` : "/c";

  if (!session) {
    return (
      <ClientLoginPage
        initialAccountSlug={accountSlug}
        returnTo={returnTo}
        embedded
      />
    );
  }

  return (
    <ClientHomeContent
      searchParams={Promise.resolve({ account: accountSlug })}
      embedded
    />
  );
}
