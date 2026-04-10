import type { SiteDraft } from "@/lib/site-builder";

export type SiteAccountInfo = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
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
  phone: string | null;
  coverUrl: string | null;
  geo: { lat: number; lng: number } | null;
};

export type SiteServiceItem = {
  id: number;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: number;
  coverUrl: string | null;
  locationIds: number[];
};

export type SiteSpecialistItem = {
  id: number;
  name: string;
  level: string | null;
  locationIds: number[];
  coverUrl: string | null;
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
  workPhotos: SiteWorkPhotos;
};
