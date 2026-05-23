import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildQueryString(params: Record<string, string | string[] | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) sp.append(key, item);
    } else if (value) {
      sp.set(key, value);
    }
  }
  return sp.toString();
}

export default async function LegacyAishaAnalyticsRedirect({ searchParams }: PageProps) {
  const query = buildQueryString((await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>);
  redirect(query ? `/crm/assistant/analytics?${query}` : "/crm/assistant/analytics");
}
