import BookingClient from "./booking-client";

type BookingEntryProps = {
  searchParams?: {
    account?: string;
  };
};

export default function BookingEntry({ searchParams }: BookingEntryProps) {
  return <BookingClient accountSlug={searchParams?.account} />;
}
