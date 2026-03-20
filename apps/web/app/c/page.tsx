import type { CSSProperties } from "react";
import { requireClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import LogoutButton from "./logout-button";
import ClientDashboard from "./client-dashboard";
import HomeLeftSidebar from "../home-left-sidebar";

const statusLabelMap: Record<string, { label: string; tone: string }> = {
  NEW: { label: "Новая", tone: "success" },
  CONFIRMED: { label: "Подтверждена", tone: "success" },
  IN_PROGRESS: { label: "В процессе", tone: "warning" },
  DONE: { label: "Завершена", tone: "neutral" },
  CANCELLED: { label: "Отменено", tone: "neutral" },
  NO_SHOW: { label: "Не пришёл", tone: "danger" },
};

type ClientHomeProps = {
  searchParams?: Promise<{ account?: string }> | { account?: string };
};

const formatPrice = (value: number | null) => {
  if (value == null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDuration = (minutes: number | null) => {
  if (!minutes || Number.isNaN(minutes)) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} мин`;
  if (mins === 0) return `${hours} ч`;
  return `${hours} ч ${mins} мин`;
};

const formatDateLabel = (value: Date, timeZone: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(value);

const formatTimeLabel = (value: Date, timeZone: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);

export default async function ClientHome({ searchParams }: ClientHomeProps) {
  const session = await requireClientSession();
  const resolvedParams = await Promise.resolve(searchParams ?? {});
  const accountSlugParam = resolvedParams?.account?.trim() || null;

  const primaryClient = session.clients[0] ?? null;
  const fullName = `${primaryClient?.firstName ?? ""} ${primaryClient?.lastName ?? ""}`.trim();
  const displayName =
    fullName ||
    primaryClient?.phone ||
    primaryClient?.email ||
    session.email ||
    "Клиент";

  const accountIds = Array.from(new Set(session.clients.map((client) => client.accountId)));

  const accountRecords = accountIds.length
    ? await prisma.account.findMany({
        where: { id: { in: accountIds } },
        select: {
          id: true,
          name: true,
          slug: true,
          timeZone: true,
          settings: { select: { cancellationWindowHours: true } },
          profile: { select: { address: true, phone: true, email: true } },
        },
      })
    : [];

  const accountBySlug = new Map(accountRecords.map((acc) => [acc.slug, acc]));

  const organizations = accountRecords.map((acc) => ({
    slug: acc.slug,
    name: acc.name,
    bookingLink: `/${buildPublicSlugId(acc.slug, acc.id)}/booking`,
  }));

  const matchedClient = accountSlugParam
    ? session.clients.find((item) => item.accountSlug === accountSlugParam)
    : null;
  const selectedClient = matchedClient ?? null;
  const selectedAccountSlug = selectedClient?.accountSlug ?? null;

  let accountData:
    | {
        id: number;
        name: string;
        slug: string;
        timeZone: string;
        cancellationWindowHours: number | null;
        address: string | null;
        phone: string | null;
        email: string | null;
      }
    | null = null;
  let appointments: Array<{
    id: number;
    startAt: Date;
    endAt: Date;
    status: string;
    priceTotal: number | null;
    durationTotalMin: number | null;
    locationName: string;
    locationAddress: string | null;
    specialistName: string | null;
    servicesLabel: string | null;
    accountName: string | null;
    accountSlug: string | null;
    accountTimeZone: string;
    cancellationWindowHours: number | null;
  }> = [];
  let profile: { firstName: string | null; lastName: string | null; phone: string | null; email: string | null } = {
    firstName: null,
    lastName: null,
    phone: null,
    email: null,
  };
  let loyalty: {
    balance: number | null;
    transactions: Array<{
      id: number;
      createdAt: Date;
      amount: number;
      type: string;
      accountName: string | null;
      accountTimeZone: string;
    }>;
  } = {
    balance: null,
    transactions: [],
  };
  let payments: {
    intents: Array<{
      id: number;
      status: string;
      amount: number;
      createdAt: Date;
      provider: string | null;
      appointmentId: number | null;
      accountName: string | null;
      accountTimeZone: string;
    }>;
    transactions: Array<{
      id: number;
      type: string;
      amount: number;
      createdAt: Date;
      providerRef: string | null;
      accountName: string | null;
      accountTimeZone: string;
    }>;
  } = { intents: [], transactions: [] };
  let documents: Array<{
    id: number;
    title: string;
    version: number;
    acceptedAt: Date;
    accountName: string | null;
    accountTimeZone: string;
  }> = [];
  let reviews: Array<{
    id: number;
    rating: number;
    comment: string | null;
    createdAt: Date;
    accountName: string | null;
    accountTimeZone: string;
  }> = [];

  if (selectedAccountSlug) {
    let account = accountBySlug.get(selectedAccountSlug) ?? null;
    if (!account) {
      account = await prisma.account.findUnique({
        where: { slug: selectedAccountSlug },
        select: {
          id: true,
          name: true,
          slug: true,
          timeZone: true,
          settings: { select: { cancellationWindowHours: true } },
          profile: { select: { address: true, phone: true, email: true } },
        },
      });
    }

    if (account && selectedClient) {
      accountData = {
        id: account.id,
        name: account.name,
        slug: account.slug,
        timeZone: account.timeZone,
        cancellationWindowHours: account.settings?.cancellationWindowHours ?? null,
        address: account.profile?.address ?? null,
        phone: account.profile?.phone ?? null,
        email: account.profile?.email ?? null,
      };

      const [client, appointmentRows, wallet, paymentIntents, paymentTransactions, acceptances, reviewRows] =
        await Promise.all([
          prisma.client.findFirst({
            where: { id: selectedClient.clientId, accountId: account.id },
            select: { firstName: true, lastName: true, phone: true, email: true },
          }),
          prisma.appointment.findMany({
            where: { accountId: account.id, clientId: selectedClient.clientId },
            orderBy: { startAt: "desc" },
            take: 50,
            select: {
              id: true,
              startAt: true,
              endAt: true,
              status: true,
              priceTotal: true,
              durationTotalMin: true,
              location: { select: { name: true, address: true } },
              specialist: {
                select: {
                  user: {
                    select: {
                      profile: { select: { firstName: true, lastName: true } },
                    },
                  },
                },
              },
              services: { select: { service: { select: { name: true } } } },
            },
          }),
          prisma.loyaltyWallet.findUnique({
            where: { clientId: selectedClient.clientId },
            select: {
              balance: true,
              transactions: {
                orderBy: { createdAt: "desc" },
                take: 10,
                select: { id: true, createdAt: true, amount: true, type: true },
              },
            },
          }),
          prisma.paymentIntent.findMany({
            where: { accountId: account.id, clientId: selectedClient.clientId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, status: true, amount: true, createdAt: true, provider: true, appointmentId: true },
          }),
          prisma.transaction.findMany({
            where: { accountId: account.id, intent: { clientId: selectedClient.clientId } },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, type: true, amount: true, createdAt: true, providerRef: true },
          }),
          prisma.legalAcceptance.findMany({
            where: { accountId: account.id, clientId: selectedClient.clientId },
            orderBy: { acceptedAt: "desc" },
            take: 10,
            select: {
              id: true,
              acceptedAt: true,
              documentVersion: { select: { version: true, document: { select: { title: true } } } },
            },
          }),
          prisma.review.findMany({
            where: { accountId: account.id, clientId: selectedClient.clientId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, rating: true, comment: true, createdAt: true },
          }),
        ]);

      if (client) {
        profile = client;
      }

      appointments = appointmentRows.map((item) => {
        const specialistName = `${item.specialist?.user?.profile?.firstName ?? ""} ${
          item.specialist?.user?.profile?.lastName ?? ""
        }`.trim();
        const servicesLabel = item.services
          .map((entry) => entry.service.name)
          .filter(Boolean)
          .join(", ");
        return {
          id: item.id,
          startAt: item.startAt,
          endAt: item.endAt,
          status: item.status,
          priceTotal: item.priceTotal ? Number(item.priceTotal) : null,
          durationTotalMin: item.durationTotalMin ?? null,
          locationName: item.location?.name ?? "Локация",
          locationAddress: item.location?.address ?? null,
          specialistName: specialistName || null,
          servicesLabel: servicesLabel || null,
          accountName: account.name,
          accountSlug: account.slug,
          accountTimeZone: account.timeZone,
          cancellationWindowHours: account.settings?.cancellationWindowHours ?? null,
        };
      });

      if (wallet) {
        loyalty = {
          balance: wallet.balance ? Number(wallet.balance) : 0,
          transactions: wallet.transactions.map((item) => ({
            id: item.id,
            createdAt: item.createdAt,
            amount: Number(item.amount),
            type: item.type,
            accountName: account.name,
            accountTimeZone: account.timeZone,
          })),
        };
      }

      payments = {
        intents: paymentIntents.map((item) => ({
          id: item.id,
          status: item.status,
          amount: Number(item.amount),
          createdAt: item.createdAt,
          provider: item.provider ?? null,
          appointmentId: item.appointmentId ?? null,
          accountName: account.name,
          accountTimeZone: account.timeZone,
        })),
        transactions: paymentTransactions.map((item) => ({
          id: item.id,
          type: item.type,
          amount: Number(item.amount),
          createdAt: item.createdAt,
          providerRef: item.providerRef ?? null,
          accountName: account.name,
          accountTimeZone: account.timeZone,
        })),
      };

      documents = acceptances.map((item) => ({
        id: item.id,
        title: item.documentVersion.document.title,
        version: item.documentVersion.version,
        acceptedAt: item.acceptedAt,
        accountName: account.name,
        accountTimeZone: account.timeZone,
      }));

      reviews = reviewRows.map((item) => ({
        id: item.id,
        rating: item.rating,
        comment: item.comment ?? null,
        createdAt: item.createdAt,
        accountName: account.name,
        accountTimeZone: account.timeZone,
      }));
    }
  } else if (accountRecords.length > 0) {
    const accountByIdLocal = new Map(accountRecords.map((acc) => [acc.id, acc]));
    const clientPairs = session.clients.map((client) => ({
      accountId: client.accountId,
      clientId: client.clientId,
    }));

    const [appointmentRows, wallets, paymentIntents, paymentTransactions, acceptances, reviewRows] =
      await Promise.all([
        prisma.appointment.findMany({
          where: { OR: clientPairs },
          orderBy: { startAt: "desc" },
          take: 50,
          select: {
            id: true,
            startAt: true,
            endAt: true,
            status: true,
            priceTotal: true,
            durationTotalMin: true,
            accountId: true,
            location: { select: { name: true, address: true } },
            specialist: {
              select: {
                user: {
                  select: {
                    profile: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
            services: { select: { service: { select: { name: true } } } },
          },
        }),
        prisma.loyaltyWallet.findMany({
          where: { clientId: { in: session.clients.map((client) => client.clientId) } },
          select: {
            clientId: true,
            balance: true,
            transactions: {
              orderBy: { createdAt: "desc" },
              take: 10,
              select: { id: true, createdAt: true, amount: true, type: true },
            },
          },
        }),
        prisma.paymentIntent.findMany({
          where: { clientId: { in: session.clients.map((client) => client.clientId) } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, status: true, amount: true, createdAt: true, provider: true, appointmentId: true, accountId: true },
        }),
        prisma.transaction.findMany({
          where: { intent: { clientId: { in: session.clients.map((client) => client.clientId) } } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, type: true, amount: true, createdAt: true, providerRef: true, accountId: true },
        }),
        prisma.legalAcceptance.findMany({
          where: { clientId: { in: session.clients.map((client) => client.clientId) } },
          orderBy: { acceptedAt: "desc" },
          take: 10,
          select: {
            id: true,
            acceptedAt: true,
            accountId: true,
            documentVersion: { select: { version: true, document: { select: { title: true } } } },
          },
        }),
        prisma.review.findMany({
          where: { clientId: { in: session.clients.map((client) => client.clientId) } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, rating: true, comment: true, createdAt: true, accountId: true },
        }),
      ]);

    appointments = appointmentRows.map((item) => {
      const account = accountByIdLocal.get(item.accountId);
      const specialistName = `${item.specialist?.user?.profile?.firstName ?? ""} ${
        item.specialist?.user?.profile?.lastName ?? ""
      }`.trim();
      const servicesLabel = item.services
        .map((entry) => entry.service.name)
        .filter(Boolean)
        .join(", ");
      return {
        id: item.id,
        startAt: item.startAt,
        endAt: item.endAt,
        status: item.status,
        priceTotal: item.priceTotal ? Number(item.priceTotal) : null,
        durationTotalMin: item.durationTotalMin ?? null,
        locationName: item.location?.name ?? "Локация",
        locationAddress: item.location?.address ?? null,
        specialistName: specialistName || null,
        servicesLabel: servicesLabel || null,
        accountName: account?.name ?? null,
        accountSlug: account?.slug ?? null,
        accountTimeZone: account?.timeZone ?? "Europe/Moscow",
        cancellationWindowHours: account?.settings?.cancellationWindowHours ?? null,
      };
    });

    const clientIdToAccount = new Map(
      session.clients.map((client) => [client.clientId, client.accountId])
    );

    const loyaltyTransactions = wallets.flatMap((wallet) => {
      const account = accountByIdLocal.get(clientIdToAccount.get(wallet.clientId) ?? 0);
      return wallet.transactions.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        amount: Number(item.amount),
        type: item.type,
        accountName: account?.name ?? null,
        accountTimeZone: account?.timeZone ?? "Europe/Moscow",
      }));
    });

    loyalty = {
      balance: wallets.reduce((sum, item) => sum + Number(item.balance ?? 0), 0),
      transactions: loyaltyTransactions.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      ),
    };

    payments = {
      intents: paymentIntents.map((item) => {
        const account = accountByIdLocal.get(item.accountId);
        return {
          id: item.id,
          status: item.status,
          amount: Number(item.amount),
          createdAt: item.createdAt,
          provider: item.provider ?? null,
          appointmentId: item.appointmentId ?? null,
          accountName: account?.name ?? null,
          accountTimeZone: account?.timeZone ?? "Europe/Moscow",
        };
      }),
      transactions: paymentTransactions.map((item) => {
        const account = accountByIdLocal.get(item.accountId ?? 0);
        return {
          id: item.id,
          type: item.type,
          amount: Number(item.amount),
          createdAt: item.createdAt,
          providerRef: item.providerRef ?? null,
          accountName: account?.name ?? null,
          accountTimeZone: account?.timeZone ?? "Europe/Moscow",
        };
      }),
    };

    documents = acceptances.map((item) => {
      const account = accountByIdLocal.get(item.accountId);
      return {
        id: item.id,
        title: item.documentVersion.document.title,
        version: item.documentVersion.version,
        acceptedAt: item.acceptedAt,
        accountName: account?.name ?? null,
        accountTimeZone: account?.timeZone ?? "Europe/Moscow",
      };
    });

    reviews = reviewRows.map((item) => {
      const account = accountByIdLocal.get(item.accountId);
      return {
        id: item.id,
        rating: item.rating,
        comment: item.comment ?? null,
        createdAt: item.createdAt,
        accountName: account?.name ?? null,
        accountTimeZone: account?.timeZone ?? "Europe/Moscow",
      };
    });
  }

  const clientTitle = "Личный кабинет";

  const pageStyle: CSSProperties = {
    fontFamily: "var(--font-sans)",
    backgroundImage:
      "radial-gradient(960px 520px at 10% -10%, rgba(255, 237, 213, 0.6) 0%, rgba(255,255,255,0) 65%), radial-gradient(820px 480px at 88% -15%, rgba(30, 41, 59, 0.08) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg, #f8fafc 0%, #f3f4f6 60%, #eef2f7 100%)",
    color: "#0f172a",
    "--bp-ink": "#0f172a",
    "--bp-muted": "#64748b",
    "--bp-paper": "rgba(255, 255, 255, 0.92)",
    "--bp-surface": "#f3f4f6",
    "--bp-stroke": "rgba(15, 23, 42, 0.08)",
    "--bp-accent": "#ef5a3c",
    "--bp-accent-strong": "#d94b2f",
    "--bp-shadow": "0 24px 55px rgba(15, 23, 42, 0.12)",
    "--site-client-button": "#ef5a3c",
    "--site-client-button-text": "#ffffff",
    "--site-button-radius": "16px",
    "--site-radius": "24px",
  } as CSSProperties;

  const now = new Date();
  const upcoming = appointments
    .filter((item) => item.startAt > now)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((item) => {
      const statusMeta = statusLabelMap[item.status] ?? { label: "Статус", tone: "neutral" };
      const canCancel =
        item.status !== "CANCELLED" &&
        item.status !== "DONE" &&
        item.status !== "NO_SHOW" &&
        item.startAt > now &&
        (item.cancellationWindowHours == null ||
          new Date(item.startAt.getTime() - item.cancellationWindowHours * 60 * 60 * 1000) > now);

      return {
        id: item.id,
        status: item.status,
        statusLabel: statusMeta.label,
        statusTone: statusMeta.tone,
        dateLabel: formatDateLabel(item.startAt, item.accountTimeZone),
        timeLabel: `${formatTimeLabel(item.startAt, item.accountTimeZone)} — ${formatTimeLabel(
          item.endAt,
          item.accountTimeZone
        )}`,
        durationLabel: formatDuration(item.durationTotalMin),
        priceLabel: formatPrice(item.priceTotal),
        locationName: item.locationName,
        locationAddress: item.locationAddress,
        specialistName: item.specialistName,
        servicesLabel: item.servicesLabel,
        canCancel,
        accountName: item.accountName,
        accountSlug: item.accountSlug,
        startAtIso: item.startAt.toISOString(),
      };
    });

  const history = appointments
    .filter((item) => item.startAt <= now)
    .map((item) => {
      const statusMeta = statusLabelMap[item.status] ?? { label: "Статус", tone: "neutral" };
      return {
        id: item.id,
        status: item.status,
        statusLabel: statusMeta.label,
        statusTone: statusMeta.tone,
        dateLabel: formatDateLabel(item.startAt, item.accountTimeZone),
        timeLabel: `${formatTimeLabel(item.startAt, item.accountTimeZone)} — ${formatTimeLabel(
          item.endAt,
          item.accountTimeZone
        )}`,
        durationLabel: formatDuration(item.durationTotalMin),
        priceLabel: formatPrice(item.priceTotal),
        locationName: item.locationName,
        locationAddress: item.locationAddress,
        specialistName: item.specialistName,
        servicesLabel: item.servicesLabel,
        canCancel: false,
        accountName: item.accountName,
        accountSlug: item.accountSlug,
        startAtIso: item.startAt.toISOString(),
      };
    });

  const bookLink = accountData ? `/${buildPublicSlugId(accountData.slug, accountData.id)}/booking` : "/";
  const accountTimeZone = accountData?.timeZone ?? appointments[0]?.accountTimeZone ?? "Europe/Moscow";

  return (
    <main className="min-h-screen" style={pageStyle}>
      <HomeLeftSidebar active="records" />
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-8 px-6 pb-16 pt-10 md:pl-[280px]">
        <header className="flex flex-col gap-6 rounded-[28px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-8 shadow-[var(--bp-shadow)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.35em] text-[color:var(--bp-muted)]">
                Marketplace ID
              </div>
              <h1 className="text-3xl font-semibold text-[color:var(--bp-ink)] md:text-4xl">
                {clientTitle}
              </h1>
              <p className="text-sm text-[color:var(--bp-muted)]">{displayName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={bookLink}
                className="inline-flex items-center justify-center rounded-[var(--site-button-radius)] bg-[color:var(--site-client-button)] px-4 py-2 text-sm font-semibold text-[color:var(--site-client-button-text)] shadow-[var(--bp-shadow)] transition hover:opacity-90"
              >
                Записаться
              </a>
              <LogoutButton accountSlug={selectedAccountSlug ?? undefined} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--bp-muted)]">
            <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1">
              Маркетплейс услуг
            </span>
            <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1">
              {organizations.length} организаций
            </span>
          </div>
        </header>

        <ClientDashboard
          accountSlug={selectedAccountSlug}
          accountName={accountData?.name ?? null}
          accountAddress={accountData?.address ?? null}
          accountPhone={accountData?.phone ?? null}
          accountTimeZone={accountTimeZone}
          displayName={displayName}
          bookLink={bookLink}
          upcoming={upcoming}
          history={history}
          cancellationWindowHours={accountData?.cancellationWindowHours ?? null}
          profile={profile}
          loyalty={{
            balance: loyalty.balance,
            transactions: loyalty.transactions.map((item) => ({
              id: item.id,
              createdAt: item.createdAt.toISOString(),
              amount: item.amount,
              type: item.type,
              accountName: item.accountName,
              accountTimeZone: item.accountTimeZone,
            })),
          }}
          payments={{
            intents: payments.intents.map((item) => ({
              id: item.id,
              status: item.status,
              amount: item.amount,
              createdAt: item.createdAt.toISOString(),
              provider: item.provider,
              appointmentId: item.appointmentId,
              accountName: item.accountName,
              accountTimeZone: item.accountTimeZone,
            })),
            transactions: payments.transactions.map((item) => ({
              id: item.id,
              type: item.type,
              amount: item.amount,
              createdAt: item.createdAt.toISOString(),
              providerRef: item.providerRef,
              accountName: item.accountName,
              accountTimeZone: item.accountTimeZone,
            })),
          }}
          documents={documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            version: doc.version,
            acceptedAt: doc.acceptedAt.toISOString(),
            accountName: doc.accountName,
            accountTimeZone: doc.accountTimeZone,
          }))}
          reviews={reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt.toISOString(),
            accountName: review.accountName,
            accountTimeZone: review.accountTimeZone,
          }))}
          organizations={organizations}
        />
      </div>
    </main>
  );
}
