import type { SiteDraft } from "@/lib/site-builder";

export type SiteAccountInfo = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
  slotStepMinutes?: number;
};

export type SiteAccountInfoWithPublicSlug = SiteAccountInfo & {
  publicSlug: string | null;
};

export type SiteAccountProfile = {
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  twitterUrl: string | null;
  dzenUrl: string | null;
  okUrl: string | null;
  maxUrl: string | null;
  vkUrl: string | null;
  viberUrl: string | null;
  pinterestUrl: string | null;
};

export type SiteEditorAccountProfile = {
  description: string;
  phone?: string;
  email?: string;
  address?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  dzenUrl?: string;
  okUrl?: string;
  maxUrl?: string;
  vkUrl?: string;
  viberUrl?: string;
  pinterestUrl?: string;
};

export type SiteBranding = {
  logoUrl: string | null;
  coverUrl: string | null;
};

export type SiteLocationItem = {
  id: number;
  name: string;
  address: string;
  description?: string | null;
  phone: string | null;
  coverUrl: string | null;
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
  photoUrls?: string[];
  photoItems?: Array<{ id: number; url: string; isCover: boolean }>;
  geo: { lat: number; lng: number } | null;
  ratingAvg?: number | null;
  ratingCount?: number;
};

export type SiteServiceItem = {
  id: number;
  name: string;
  description: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  baseDurationMin: number;
  basePrice: number;
  minDurationMin?: number | null;
  minPrice?: number | null;
  computedDurationMin?: number | null;
  computedPrice?: number | null;
  specialistIds?: number[];
  allowMultiServiceBooking?: boolean;
  bookingType?: "SINGLE" | "GROUP";
  groupCapacityDefault?: number | null;
  coverUrl: string | null;
  photoUrls: string[];
  photoItems?: Array<{ id: number; url: string; isCover: boolean }>;
  locationIds: number[];
  ratingAvg?: number | null;
  ratingCount?: number;
};

export type SiteServiceCategoryItem = {
  id: number;
  name: string;
};

export type SiteSpecialistLevelItem = {
  id: number;
  name: string;
};

export type SiteSpecialistItem = {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  levelId?: number | null;
  level: string | null;
  role?: string | null;
  avatarUrl?: string | null;
  categories?: Array<{ id: number; name: string; slug: string }>;
  locationIds: number[];
  coverUrl: string | null;
  photoUrls?: string[];
  photoItems?: Array<{ id: number; url: string; isCover: boolean }>;
  ratingAvg?: number | null;
  ratingCount?: number;
};

export type SiteReviewItem = {
  id: number;
  rating: number;
  comment: string | null;
  entityType: string;
  entityId: string | null;
  replyText: string | null;
  createdAt: string;
  clientName: string;
  locationName?: string | null;
  specialistName?: string | null;
  servicesLabel?: string | null;
};

export type SitePromoItem = {
  id: number;
  name: string;
  type: "PERCENT" | "FIXED" | "BUNDLE";
  value: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  codes: string[];
};

export type SiteWorkPhotos = {
  locations: Array<{ entityId: string; url: string }>;
  services: Array<{ entityId: string; url: string }>;
  specialists: Array<{ entityId: string; url: string }>;
};

export type SiteLegalDocumentItem = {
  id: number;
  title: string;
  description?: string | null;
  isRequired: boolean;
  versionId: number;
  version: number;
  content?: string;
  publishedAt: string;
};

export type PublicSiteData = {
  account: SiteAccountInfo;
  publicSlug: string;
  draft: SiteDraft;
  accountProfile: SiteAccountProfile;
  branding: SiteBranding;
  locations: SiteLocationItem[];
  services: SiteServiceItem[];
  specialists: SiteSpecialistItem[];
  promos: SitePromoItem[];
  reviews: SiteReviewItem[];
  workPhotos: SiteWorkPhotos;
  legalDocuments: SiteLegalDocumentItem[];
  platformLegalDocuments: SiteLegalDocumentItem[];
};
