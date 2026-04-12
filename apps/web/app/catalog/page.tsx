import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import HomeLeftSidebar from "../home-left-sidebar";
import HomeHeroSection from "../home-hero-section";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CatalogPageProps = {
  searchParams: Promise<{
    q?: string;
    city?: string;
    category?: string;
    sort?: string;
  }>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const q = String(params?.q ?? "").trim();
  const city = String(params?.city ?? "").trim();
  const category = String(params?.category ?? "").trim();
  const sort = String(params?.sort ?? "").trim();

  const categoryList = await prisma.serviceCategory.findMany({
    where: {
      services: { some: { account: { status: "ACTIVE" } } },
    },
    select: { id: true, name: true, slug: true, _count: { select: { services: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  const accountWhere = {
    status: "ACTIVE" as const,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { profile: { description: { contains: q, mode: "insensitive" as const } } },
            { locations: { some: { address: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
    ...(city
      ? { locations: { some: { address: { contains: city, mode: "insensitive" as const } } } }
      : {}),
    ...(category
      ? {
          services: {
            some: {
              category: {
                slug: category,
              },
            },
          },
        }
      : {}),
  };

  const orderBy =
    sort === "services"
      ? { services: { _count: "desc" as const } }
      : sort === "locations"
        ? { locations: { _count: "desc" as const } }
        : { id: "desc" as const };

  const accounts = await prisma.account.findMany({
    where: accountWhere,
    orderBy,
    select: {
      id: true,
      name: true,
      slug: true,
      profile: { select: { description: true, address: true } },
      locations: {
        select: { id: true, address: true, name: true },
        take: 2,
      },
      _count: { select: { services: true, locations: true } },
    },
    take: 60,
  });

  const pageStyle: CSSProperties = {
    fontFamily: 'var(--font-montserrat), var(--font-sans)',
    color: "#111827",
    backgroundColor: "#f6f7fb",
    "--bp-ink": "#111827",
    "--bp-muted": "#6b7280",
    "--bp-paper": "#ffffff",
    "--bp-stroke": "rgba(17, 24, 39, 0.08)",
    "--bp-accent": "#ff5a5f",
    "--bp-accent-strong": "#e14b50",
    "--bp-shadow": "0 24px 50px rgba(17, 24, 39, 0.12)",
  } as CSSProperties;

  return (
    <main className="min-h-screen" style={pageStyle}>
      <HomeLeftSidebar active="catalog" />
      <div className="mx-auto w-full max-w-[1560px] px-6 pb-20 pt-6 md:pl-[280px]">
        <div className="flex flex-col gap-6">
          <HomeHeroSection />

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-4">
              <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-white p-4 shadow-[var(--bp-shadow)]">
                <form className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-[color:var(--bp-muted)]">Поиск</div>
                    <input
                      name="q"
                      defaultValue={q}
                      placeholder="Студия, адрес, услуга"
                      className="mt-2 h-10 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[color:var(--bp-muted)]">Город</div>
                    <input
                      name="city"
                      defaultValue={city}
                      placeholder="Например, ваш город"
                      className="mt-2 h-10 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[color:var(--bp-muted)]">Категория</div>
                    <select
                      name="category"
                      defaultValue={category}
                      className="mt-2 h-10 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 text-sm"
                    >
                      <option value="">Все категории</option>
                      {categoryList.map((item) => (
                        <option key={item.id} value={item.slug}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[color:var(--bp-muted)]">
                      Сортировка
                    </div>
                    <select
                      name="sort"
                      defaultValue={sort}
                      className="mt-2 h-10 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 text-sm"
                    >
                      <option value="">По умолчанию</option>
                      <option value="services">По количеству услуг</option>
                      <option value="locations">По локациям</option>
                    </select>
                  </div>
                  <button className="w-full rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-xs font-semibold text-white">
                    Показать
                  </button>
                </form>
              </div>
            </aside>

            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-[color:var(--bp-muted)]">
                  Найдено: {accounts.length}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {accounts.map((account) => {
                  const publicSlug = buildPublicSlugId(account.slug, account.id);
                  const firstLocation = account.locations[0];
                  return (
                    <div
                      key={account.id}
                      className="flex h-full flex-col gap-3 rounded-[26px] border border-[color:var(--bp-stroke)] bg-white p-5 shadow-[var(--bp-shadow)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold">{account.name}</div>
                          <div className="text-xs text-[color:var(--bp-muted)]">
                            {firstLocation?.address ??
                              account.profile?.address ??
                              "Адрес не указан"}
                          </div>
                        </div>
                        <span className="rounded-full bg-[color:var(--bp-accent)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--bp-accent)]">
                          Витрина
                        </span>
                      </div>

                      <div className="text-sm text-[color:var(--bp-muted)]">
                        {account.profile?.description ??
                          "Премиальные услуги и проверенные специалисты."}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-[color:var(--bp-muted)]">
                        <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1">
                          Услуг: {account._count.services}
                        </span>
                        <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1">
                          Локаций: {account._count.locations}
                        </span>
                      </div>

                      <div className="mt-auto flex gap-2">
                        <a
                          href={`/${publicSlug}/booking`}
                          className="flex-1 rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-center text-xs font-semibold text-white"
                        >
                          Записаться
                        </a>
                        <a
                          href={`/${publicSlug}`}
                          className="flex-1 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-center text-xs font-semibold"
                        >
                          Открыть
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

