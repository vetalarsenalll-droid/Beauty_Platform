import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";

type NominatimPlace = {
  display_name?: string;
  lat?: string;
  lon?: string;
  category?: string;
  type?: string;
  addresstype?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    road?: string;
    pedestrian?: string;
    house_number?: string;
    postcode?: string;
  };
};

const ADDRESS_CATEGORIES = new Set(["building", "place", "boundary", "highway"]);
const ADDRESS_TYPES = new Set([
  "house",
  "apartments",
  "residential",
  "yes",
  "city",
  "town",
  "village",
  "administrative",
  "road",
  "street",
]);
const ADDRESS_TYPES_BY_ADDRESS = new Set(["house", "building", "road", "city", "town", "village"]);

function isAddressLike(place: NominatimPlace) {
  return (
    ADDRESS_CATEGORIES.has(String(place.category ?? "")) ||
    ADDRESS_TYPES.has(String(place.type ?? "")) ||
    ADDRESS_TYPES_BY_ADDRESS.has(String(place.addresstype ?? ""))
  );
}

function formatAddress(place: NominatimPlace) {
  const address = place.address;
  if (!address) return String(place.display_name ?? "").trim();

  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  const road = address.road ?? address.pedestrian;
  const house = address.house_number;
  const parts = [city, road, house].filter(Boolean);
  if (parts.length >= 2) return parts.join(", ");

  return String(place.display_name ?? "").trim();
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasHouseSuffix(value: string) {
  return /(^|[^\p{L}\p{N}])\d+\s*\p{L}+\.?(?=$|[^\p{L}\p{N}])/iu.test(value);
}

function expandShortLiteralSuffix(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /(^|[^\p{L}\p{N}])(\d+)\s*(\p{L})(?=$|[^\p{L}\p{N}])/giu,
      (_match, prefix: string, house: string, suffix: string) =>
        `${prefix}${house} лит${suffix.toUpperCase()}`
    );
}

async function searchNominatim(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10");
  url.searchParams.set("countrycodes", "ru");

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "ru",
      "User-Agent": "BeautyPlatform/1.0 geocoding",
    },
    next: { revalidate: 60 * 60 * 24 },
  }).catch(() => null);

  if (!response?.ok) return null;
  return (await response.json().catch(() => [])) as NominatimPlace[];
}

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.locations.read");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") ?? "").trim();
  if (query.length < 3) {
    return jsonOk({ items: [] });
  }

  let places = await searchNominatim(query);
  if (!places) {
    return jsonError(
      "GEOCODE_FAILED",
      "Не удалось определить координаты по адресу.",
      null,
      502
    );
  }

  const expandedQuery = hasHouseSuffix(query) ? expandShortLiteralSuffix(query) : "";
  const expandedPlaces =
    expandedQuery && expandedQuery !== query ? await searchNominatim(expandedQuery) : null;

  if (expandedPlaces?.length) {
    places = [...expandedPlaces, ...places];
  }

  const seen = new Set<string>();
  const items = places
    .filter(isAddressLike)
    .map((place) => {
      const lat = Number(place.lat);
      const lng = Number(place.lon);
      const address = formatAddress(place);
      const label = address;
      const key = normalizeAddress(address);
      if (!label || seen.has(key) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      seen.add(key);
      return { label, address, lat, lng };
    })
    .filter((item): item is { label: string; address: string; lat: number; lng: number } =>
      Boolean(item)
    );

  const crmResponse = jsonOk({ items });
  return applyCrmAccessCookie(crmResponse, auth);
}
