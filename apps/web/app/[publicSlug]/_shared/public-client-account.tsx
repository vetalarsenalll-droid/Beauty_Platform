import { ClientHomeContent } from "@/app/c/client-home-content";
import ClientLoginPage from "@/app/c/login/login-client";
import ClientRegisterPage from "@/app/c/register/register-client";
import { getClientSession } from "@/lib/auth";

export type ClientAuthMode = "login" | "register";

type PublicClientAccountProps = {
  accountSlug: string;
  publicSlug: string;
  authMode?: ClientAuthMode;
};

export default async function PublicClientAccount({
  accountSlug,
  publicSlug,
  authMode = "login",
}: PublicClientAccountProps) {
  const session = await getClientSession();
  const returnTo = publicSlug ? `/${publicSlug}/client` : "/c";
  const loginHref = publicSlug ? `/${publicSlug}/client` : accountSlug ? `/c/login?account=${accountSlug}` : "/c/login";
  const registerHref = publicSlug
    ? `/${publicSlug}/client?auth=register`
    : accountSlug
      ? `/c/register?account=${accountSlug}`
      : "/c/register";

  if (!session) {
    if (authMode === "register") {
      return (
        <ClientRegisterPage
          initialAccountSlug={accountSlug}
          returnTo={returnTo}
          loginHref={loginHref}
          embedded
        />
      );
    }

    return (
      <ClientLoginPage
        initialAccountSlug={accountSlug}
        returnTo={returnTo}
        registerHref={registerHref}
        embedded
      />
    );
  }

  return (
    <ClientHomeContent
      searchParams={Promise.resolve({ account: accountSlug })}
      embedded
      embeddedReturnTo={returnTo}
    />
  );
}
