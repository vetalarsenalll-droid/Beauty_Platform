import BookingClient from "@/app/booking/booking-client";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId, parsePublicSlugId } from "@/lib/public-slug";

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

  return (
    <BookingClient
      accountSlug={account.slug}
      accountPublicSlug={canonicalSlug}
    />
  );
}
