"use client";

import BookingClient from "@/app/booking/booking-client";
import type { SiteLoaderConfig } from "@/lib/site-builder";

type PublicBookingClientProps = {
  accountSlug?: string;
  accountPublicSlug?: string;
  loaderConfig?: SiteLoaderConfig | null;
  initialContext?: {
    account: {
      id: number;
      name: string;
      slug: string;
      timeZone: string;
      slotStepMinutes?: number;
    };
    locations: Array<{
      id: number;
      name: string;
      address: string | null;
      coverUrl?: string | null;
      hours?: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      }>;
      exceptions?: Array<{
        date: string;
        isClosed: boolean;
        startTime: string | null;
        endTime: string | null;
      }>;
    }>;
    legalDocuments?: Array<{
      id: number;
      title: string;
      description?: string | null;
      isRequired: boolean;
      versionId: number;
      version: number;
      content?: string;
      publishedAt: string;
    }>;
    platformLegalDocuments?: Array<{
      id: number;
      title: string;
      description?: string | null;
      isRequired: boolean;
      versionId: number;
      version: number;
      content?: string;
      publishedAt: string;
    }>;
  } | null;
};

export default function PublicBookingClient({
  accountSlug,
  accountPublicSlug,
  loaderConfig,
  initialContext,
}: PublicBookingClientProps) {
  return (
    <BookingClient
      accountSlug={accountSlug}
      accountPublicSlug={accountPublicSlug}
      loaderConfig={loaderConfig}
      initialContext={initialContext}
    />
  );
}
