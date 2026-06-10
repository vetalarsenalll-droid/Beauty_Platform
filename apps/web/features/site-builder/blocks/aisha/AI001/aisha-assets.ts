export type AishaAssetOption = { name: string; label: string; url: string };

const aishaAssetListCache: Record<string, AishaAssetOption[] | undefined> = {};
const aishaAssetListRequests: Record<string, Promise<AishaAssetOption[]> | undefined> = {};
const preloadedAssetUrls = new Set<string>();

function normalizeAssetItems(payload: unknown): AishaAssetOption[] {
  const items =
    payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  return items.filter(
    (item: unknown): item is AishaAssetOption =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as AishaAssetOption).name === "string" &&
          typeof (item as AishaAssetOption).label === "string" &&
          typeof (item as AishaAssetOption).url === "string"
      )
  );
}

export function getCachedAishaAssetItems(endpoint: string) {
  return aishaAssetListCache[endpoint];
}

export function loadAishaAssetItems(endpoint: string) {
  if (aishaAssetListCache[endpoint]) {
    return Promise.resolve(aishaAssetListCache[endpoint]);
  }

  aishaAssetListRequests[endpoint] ??= fetch(endpoint)
    .then((response) => (response.ok ? response.json() : { items: [] }))
    .then((payload) => {
      const items = normalizeAssetItems(payload);
      aishaAssetListCache[endpoint] = items;
      return items;
    })
    .catch(() => {
      aishaAssetListCache[endpoint] = [];
      return [];
    });

  return aishaAssetListRequests[endpoint];
}

export function preloadAssetImage(url: string) {
  if (!url || typeof window === "undefined" || preloadedAssetUrls.has(url)) return;
  preloadedAssetUrls.add(url);
  const image = new window.Image();
  image.decoding = "async";
  image.src = url;
}

export function preloadAishaAssets() {
  const endpoints = ["/api/v1/site-builder/aisha-icons", "/api/v1/site-builder/aisha-backgrounds"];
  void Promise.all(endpoints.map((endpoint) => loadAishaAssetItems(endpoint))).then((groups) => {
    groups.flat().forEach((item) => preloadAssetImage(item.url));
  });
}
