import BookingClient from "./booking-client";

type BookingEntryProps = {
  searchParams: Promise<{
    account?: string;
  }>;
};

export default async function BookingEntry({ searchParams }: BookingEntryProps) {
  const params = await searchParams;
  return <BookingClient accountSlug={params?.account} />;
}
