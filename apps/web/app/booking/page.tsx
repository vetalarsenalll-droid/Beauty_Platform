import { notFound, redirect } from "next/navigation";
import { buildPublicSlugId } from "@/lib/public-slug";
import { getPublicAccountBySlug } from "@/lib/platform-subscriptions";

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

  const account = await getPublicAccountBySlug(accountSlug);

  if (!account) {
    notFound();
    return null;
  }

  const accountRecord = account;
  const publicSlug = buildPublicSlugId(accountRecord.slug, accountRecord.id);
  redirect(`/${publicSlug}/booking`);

  return null;
}
