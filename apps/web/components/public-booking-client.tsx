"use client";

import { useEffect, useState } from "react";
import BookingClient from "@/app/booking/booking-client";
import type { SiteLoaderConfig } from "@/lib/site-builder";

type PublicBookingClientProps = {
  accountSlug?: string;
  accountPublicSlug?: string;
  loaderConfig?: SiteLoaderConfig | null;
};

export default function PublicBookingClient({
  accountSlug,
  accountPublicSlug,
  loaderConfig,
}: PublicBookingClientProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-[320px]" aria-hidden="true" />;
  }

  return (
    <BookingClient
      accountSlug={accountSlug}
      accountPublicSlug={accountPublicSlug}
      loaderConfig={loaderConfig}
    />
  );
}
