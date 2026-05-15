import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ReviewStatus } from "@prisma/client";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const statusLabels: Record<ReviewStatus, string> = {
  PUBLISHED: "Опубликован",
  PENDING: "На модерации",
  HIDDEN: "Скрыт",
};

function stars(rating: number) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="whitespace-nowrap text-[#ff9f0a]" aria-label={`Оценка ${value} из 5`}>
      {"★".repeat(value)}
      <span className="text-[color:var(--bp-stroke)]">{"★".repeat(5 - value)}</span>
    </span>
  );
}

async function refreshRatingAggregate(accountId: number, entityType: string, entityId: string) {
  const stats = await prisma.review.aggregate({
    where: { accountId, entityType, entityId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.ratingAggregate.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: {
      accountId,
      entityType,
      entityId,
      ratingAvg: stats._avg.rating ?? 0,
      ratingCount: stats._count.rating,
    },
    update: {
      ratingAvg: stats._avg.rating ?? 0,
      ratingCount: stats._count.rating,
    },
  });
}

async function refreshAppointmentReviewAggregates(accountId: number, appointmentId: number | null) {
  if (!appointmentId) return;

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, accountId },
    select: {
      locationId: true,
      specialistId: true,
      services: { select: { serviceId: true } },
    },
  });
  if (!appointment) return;

  const refreshByAppointment = async (
    entityType: string,
    entityId: string,
    appointmentWhere: { locationId?: number; specialistId?: number; services?: { some: { serviceId: number } } }
  ) => {
    const stats = await prisma.review.aggregate({
      where: {
        accountId,
        status: "PUBLISHED",
        appointmentId: { not: null },
        appointment: appointmentWhere,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.ratingAggregate.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: {
        accountId,
        entityType,
        entityId,
        ratingAvg: stats._avg.rating ?? 0,
        ratingCount: stats._count.rating,
      },
      update: {
        ratingAvg: stats._avg.rating ?? 0,
        ratingCount: stats._count.rating,
      },
    });
  };

  await refreshByAppointment("account", String(accountId), {});
  await refreshByAppointment("location", String(appointment.locationId), { locationId: appointment.locationId });
  await refreshByAppointment("specialist", String(appointment.specialistId), { specialistId: appointment.specialistId });
  await Promise.all(
    Array.from(new Set(appointment.services.map((item) => item.serviceId))).map((serviceId) =>
      refreshByAppointment("service", String(serviceId), { services: { some: { serviceId } } })
    )
  );
}

async function updateReviewStatus(formData: FormData) {
  "use server";

  const session = await requireCrmPermission("crm.clients.update");
  const reviewId = Number(formData.get("reviewId"));
  const status = String(formData.get("status") ?? "");

  if (!Number.isInteger(reviewId) || !["PUBLISHED", "PENDING", "HIDDEN"].includes(status)) {
    redirect("/crm/reviews");
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, accountId: session.accountId },
    select: { id: true, accountId: true, entityType: true, entityId: true, appointmentId: true },
  });
  if (!review) redirect("/crm/reviews");

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: { status: status as ReviewStatus },
    select: { accountId: true, entityType: true, entityId: true, appointmentId: true },
  });

  await refreshRatingAggregate(updated.accountId, updated.entityType, updated.entityId ?? String(updated.accountId));
  await refreshAppointmentReviewAggregates(updated.accountId, updated.appointmentId);
  revalidatePath("/crm/reviews");
  redirect("/crm/reviews");
}

async function updateReviewReply(formData: FormData) {
  "use server";

  const session = await requireCrmPermission("crm.clients.update");
  const reviewId = Number(formData.get("reviewId"));
  const replyText = String(formData.get("replyText") ?? "").trim();

  if (!Number.isInteger(reviewId) || replyText.length > 1000) {
    redirect("/crm/reviews");
  }

  await prisma.review.updateMany({
    where: { id: reviewId, accountId: session.accountId },
    data: {
      replyText: replyText || null,
      repliedAt: replyText ? new Date() : null,
    },
  });

  revalidatePath("/crm/reviews");
  redirect("/crm/reviews");
}

async function updateReviewSettings(formData: FormData) {
  "use server";

  const session = await requireCrmPermission("crm.settings.update");
  const reviewAutoPublish = formData.get("reviewAutoPublish") === "on";
  const reviewAllowReplies = formData.get("reviewAllowReplies") === "on";
  await prisma.accountSetting.upsert({
    where: { accountId: session.accountId },
    create: {
      accountId: session.accountId,
      reviewAutoPublish,
      reviewAllowReplies,
    },
    update: {
      reviewAutoPublish,
      reviewAllowReplies,
    },
  });

  revalidatePath("/crm/reviews");
  redirect("/crm/reviews");
}

function entityKey(review: { entityType: string; entityId: string | null; accountId: number }) {
  return `${review.entityType}:${review.entityId ?? review.accountId}`;
}

export default async function CrmReviewsPage() {
  const session = await requireCrmPermission("crm.clients.read");
  const [reviews, settings] = await Promise.all([
    prisma.review.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
      include: { client: true },
      take: 200,
    }),
    prisma.accountSetting.findUnique({ where: { accountId: session.accountId } }),
  ]);
  const reviewSettings = settings ?? { reviewAutoPublish: true, reviewAllowReplies: true };

  const locationIds = reviews.filter((item) => item.entityType === "location" && item.entityId).map((item) => Number(item.entityId));
  const serviceIds = reviews.filter((item) => item.entityType === "service" && item.entityId).map((item) => Number(item.entityId));
  const specialistIds = reviews.filter((item) => item.entityType === "specialist" && item.entityId).map((item) => Number(item.entityId));

  const [locations, services, specialists] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: session.accountId, id: { in: locationIds.filter(Number.isInteger) } },
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { accountId: session.accountId, id: { in: serviceIds.filter(Number.isInteger) } },
      select: { id: true, name: true },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId: session.accountId, id: { in: specialistIds.filter(Number.isInteger) } },
      select: { id: true, user: { select: { email: true, profile: true } } },
    }),
  ]);

  const locationNames = new Map(locations.map((item) => [String(item.id), item.name]));
  const serviceNames = new Map(services.map((item) => [String(item.id), item.name]));
  const specialistNames = new Map(
    specialists.map((item) => [
      String(item.id),
      [item.user.profile?.firstName, item.user.profile?.lastName].filter(Boolean).join(" ") || item.user.email,
    ])
  );

  const entityLabel = (review: (typeof reviews)[number]) => {
    if (review.entityType === "location") return locationNames.get(review.entityId ?? "") ?? `Локация #${review.entityId}`;
    if (review.entityType === "specialist") return specialistNames.get(review.entityId ?? "") ?? `Специалист #${review.entityId}`;
    if (review.entityType === "service") return serviceNames.get(review.entityId ?? "") ?? `Услуга #${review.entityId}`;
    return "Аккаунт";
  };

  const total = reviews.length;
  const published = reviews.filter((item) => item.status === "PUBLISHED");
  const pending = reviews.filter((item) => item.status === "PENDING").length;
  const hidden = reviews.filter((item) => item.status === "HIDDEN").length;
  const avg = published.length > 0 ? published.reduce((sum, item) => sum + item.rating, 0) / published.length : 0;
  const entityCount = new Set(reviews.map(entityKey)).size;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Средний рейтинг</div>
          <div className="mt-2 flex items-center gap-3 text-3xl font-semibold">
            {avg ? avg.toFixed(1).replace(".", ",") : "0,0"}
            {stars(Math.round(avg))}
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Всего отзывов</div>
          <div className="mt-2 text-3xl font-semibold">{total}</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Опубликовано</div>
          <div className="mt-2 text-3xl font-semibold">{published.length}</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">На модерации</div>
          <div className="mt-2 text-3xl font-semibold">{pending}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Отзывы</h1>
            <p className="mt-1 text-sm text-[color:var(--bp-muted)]">
              Модерация отзывов аккаунта, локаций, специалистов и услуг.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-[color:var(--bp-muted)] sm:grid-cols-3 lg:min-w-[420px]">
            <span>Скрыто: {hidden}</span>
            <span>Объектов: {entityCount}</span>
            <span>Лимит списка: 200</span>
          </div>
        </div>

        <form action={updateReviewSettings} className="mt-5 grid gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-bg)] p-4 md:grid-cols-3">
          <label className="flex items-center gap-3 text-sm">
            <input name="reviewAutoPublish" type="checkbox" defaultChecked={reviewSettings.reviewAutoPublish} />
            Публиковать новые отзывы сразу
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input name="reviewAllowReplies" type="checkbox" defaultChecked={reviewSettings.reviewAllowReplies} />
            Разрешить ответы компании
          </label>
          <button className="rounded-xl bg-[color:var(--bp-ink)] px-4 py-2 text-sm font-semibold text-white" type="submit">
            Сохранить настройки
          </button>
        </form>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)]">
          {reviews.length === 0 ? (
            <div className="p-6 text-sm text-[color:var(--bp-muted)]">Отзывов пока нет.</div>
          ) : (
            <div className="divide-y divide-[color:var(--bp-stroke)]">
              {reviews.map((review) => {
                const clientName =
                  [review.client.firstName, review.client.lastName].filter(Boolean).join(" ") ||
                  review.client.email ||
                  review.client.phone ||
                  "Клиент";
                return (
                  <article key={review.id} className="grid gap-4 p-5 xl:grid-cols-[220px_1fr_220px]">
                    <div>
                      <div className="font-semibold">{clientName}</div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                        {review.createdAt.toLocaleDateString("ru-RU")}
                      </div>
                      <div className="mt-3 inline-flex rounded-full bg-[color:var(--bp-chip)] px-3 py-1 text-xs text-[color:var(--bp-muted)]">
                        {statusLabels[review.status]}
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        {stars(review.rating)}
                        <span className="rounded-full bg-[color:var(--bp-chip)] px-3 py-1 text-xs text-[color:var(--bp-muted)]">
                          {entityLabel(review)}
                        </span>
                      </div>
                      {review.comment ? <p className="mt-3 text-sm leading-6">{review.comment}</p> : null}
                      <form action={updateReviewReply} className="mt-4 space-y-2">
                        <input name="reviewId" type="hidden" value={review.id} />
                        <textarea
                          name="replyText"
                          defaultValue={review.replyText ?? ""}
                          disabled={!reviewSettings.reviewAllowReplies}
                          className="min-h-20 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)] disabled:opacity-60"
                          placeholder="Ответ компании"
                        />
                        <button
                          className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold disabled:opacity-60"
                          disabled={!reviewSettings.reviewAllowReplies}
                          type="submit"
                        >
                          Сохранить ответ
                        </button>
                      </form>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(["PUBLISHED", "PENDING", "HIDDEN"] as ReviewStatus[]).map((status) => (
                        <form key={status} action={updateReviewStatus}>
                          <input name="reviewId" type="hidden" value={review.id} />
                          <input name="status" type="hidden" value={status} />
                          <button
                            className="w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-left text-sm font-semibold disabled:bg-[color:var(--bp-chip)] disabled:text-[color:var(--bp-muted)]"
                            disabled={review.status === status}
                            type="submit"
                          >
                            {statusLabels[status]}
                          </button>
                        </form>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
