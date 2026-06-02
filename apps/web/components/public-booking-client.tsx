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
      description?: string | null;
      coverUrl?: string | null;
      photoUrls?: string[];
      workPhotoUrls?: string[];
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
    payments?: {
      requireDeposit: boolean;
      requirePaymentToConfirm: boolean;
      bookingOnlinePaymentMode?: "DISABLED" | "PREPAYMENT_FIXED" | "PREPAYMENT_PERCENT" | "FULL_PAYMENT";
      bookingAllowPayLater?: boolean;
      bookingAllowPrepaymentFixed?: boolean;
      bookingAllowPrepaymentPercent?: boolean;
      bookingAllowFullPayment?: boolean;
      bookingPrepaymentAmount?: number | null;
      bookingPrepaymentPercent?: number | null;
      bookingFullPaymentDiscountPercent?: number | null;
      onlinePaymentAvailable: boolean;
      provider: string | null;
      mode: string | null;
    };
    workPhotos?: {
      locations?: Array<{ entityId: string; url: string }>;
      services?: Array<{ entityId: string; url: string }>;
      specialists?: Array<{ entityId: string; url: string }>;
    };
  } | null;
  initialServices?: Array<{
    id: number;
    name: string;
    description: string | null;
    categoryName?: string | null;
    categorySlug?: string | null;
    baseDurationMin: number;
    basePrice: number;
    computedDurationMin?: number | null;
    computedPrice?: number | null;
    minDurationMin?: number | null;
    minPrice?: number | null;
    specialistIds?: number[];
    allowMultiServiceBooking?: boolean;
    bookingType?: "SINGLE" | "GROUP";
    groupCapacityDefault?: number | null;
    coverUrl?: string | null;
    photoUrls?: string[];
    workPhotoUrls?: string[];
    locationIds?: number[];
  }>;
  initialSpecialists?: Array<{
    id: number;
    name: string;
    role: string | null;
    bio?: string | null;
    levelId?: number | null;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    photoUrls?: string[];
    workPhotoUrls?: string[];
    categories?: Array<{ id: number; name: string; slug: string }>;
    locationIds?: number[];
  }>;
  initialWorkPhotos?: {
    locations?: Array<{ entityId: string; url: string }>;
    services?: Array<{ entityId: string; url: string }>;
    specialists?: Array<{ entityId: string; url: string }>;
  };
  designVariant?: "classic" | "future";
};

export default function PublicBookingClient({
  accountSlug,
  accountPublicSlug,
  loaderConfig,
  initialContext,
  initialServices,
  initialSpecialists,
  initialWorkPhotos,
  designVariant,
}: PublicBookingClientProps) {
  return (
    <BookingClient
      accountSlug={accountSlug}
      accountPublicSlug={accountPublicSlug}
      loaderConfig={loaderConfig}
      initialContext={initialContext}
      initialServices={initialServices}
      initialSpecialists={initialSpecialists}
      initialWorkPhotos={initialWorkPhotos}
      designVariant={designVariant}
    />
  );
}
