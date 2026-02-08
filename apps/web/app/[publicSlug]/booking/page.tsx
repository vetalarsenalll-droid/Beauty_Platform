import BookingClient from "@/app/booking/booking-client";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/auth";
import { buildPublicSlugId, parsePublicSlugId } from "@/lib/public-slug";
import { renderPublicMenu } from "../_shared/menu-render";

type PageProps = {
  params: Promise<{ publicSlug: string }> | { publicSlug: string };
};

export default async function PublicBookingPage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const parsed = parsePublicSlugId(resolved.publicSlug);
  if (!parsed) {
    notFound();
  }

  const account = await prisma.account.findUnique({
    where: { id: parsed.id },
    select: { id: true, slug: true },
  });

  if (!account) {
    notFound();
  }

  const canonicalSlug = buildPublicSlugId(account.slug, account.id);
  if (canonicalSlug !== resolved.publicSlug) {
    redirect(`/${canonicalSlug}/booking`);
  }

  const clientSession = await getClientSession();
  const accountLinkOverride = clientSession
    ? `/c?account=${account.slug}`
    : `/c/login?account=${account.slug}`;
  const menuNode = await renderPublicMenu(canonicalSlug, accountLinkOverride);

  return (
    <div className="w-full">
      {menuNode}
      <BookingClient
        accountSlug={account.slug}
        accountPublicSlug={canonicalSlug}
      />
    </div>
  );
}
