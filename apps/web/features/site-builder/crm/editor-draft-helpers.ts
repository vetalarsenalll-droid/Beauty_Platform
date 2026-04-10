import type { SiteBlock, SiteDraft, SitePages } from "@/lib/site-builder";
import type { CurrentEntity, EntityPageKey } from "./site-client-core";

export function ensurePages(value: SiteDraft): SitePages {
  return (
    value.pages ?? {
      home: value.blocks,
      booking: [],
      client: [],
      locations: [],
      services: [],
      specialists: [],
      promos: [],
    }
  );
}

export function ensureEntityPages(
  value: SiteDraft
): Record<EntityPageKey, Record<string, SiteBlock[]>> {
  return {
    locations: value.entityPages?.locations ?? {},
    services: value.entityPages?.services ?? {},
    specialists: value.entityPages?.specialists ?? {},
    promos: value.entityPages?.promos ?? {},
  } as Record<EntityPageKey, Record<string, SiteBlock[]>>;
}

export function resolveEntityPageKey(entity: CurrentEntity): EntityPageKey | null {
  if (!entity) return null;
  if (entity.type === "location") return "locations";
  if (entity.type === "service") return "services";
  if (entity.type === "specialist") return "specialists";
  if (entity.type === "promo") return "promos";
  return null;
}
