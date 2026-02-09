import BookingClient from "./booking-client";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";

type BookingEntryProps = {
  searchParams: Promise<{
    account?: string;
  }>;
};

export default async function BookingEntry({ searchParams }: BookingEntryProps) {
  const params = await searchParams;
  const accountSlug = params?.account?.trim();
  if (!accountSlug) {
    notFound();
  }

  const account = await prisma.account.findUnique({
    where: { slug: accountSlug },
    select: { id: true, slug: true },
  });

  if (!account) {
    notFound();
    return null;
  }

  const accountRecord = account;
  const publicSlug = buildPublicSlugId(accountRecord.slug, accountRecord.id);
  redirect(`/${publicSlug}/booking`);

  return null;
}
