import { notFound, redirect } from "next/navigation";
import { PLAN_MODULES } from "@/lib/platform-plan-features";
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

  const account = await getPublicAccountBySlug(accountSlug, PLAN_MODULES.onlineBooking);

  if (!account) {
    notFound();
    return null;
  }

  const publicSlug = buildPublicSlugId(account.slug, account.id);
  redirect(`/${publicSlug}/booking`);

  return null;
}
