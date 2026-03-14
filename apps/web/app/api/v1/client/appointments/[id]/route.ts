import { AppointmentStatus } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function resolveAccountClient(
  request: Request,
  session: NonNullable<Awaited<ReturnType<typeof getClientSession>>>
) {
  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account")?.trim() || "";
  const target = accountSlug
    ? session.clients.find((item) => item.accountSlug === accountSlug) ?? null
    : null;

  return {
    accountSlug: target?.accountSlug ?? null,
    accountId: target?.accountId ?? null,
    clientId: target?.clientId ?? null,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинет.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);

  const { id } = await params;
  const appointmentId = Number(id);
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return jsonError("INVALID_APPOINTMENT", "Некорректная запись.", null, 400);
  }

  const body = (await request.json().catch(() => null)) as { action?: string; comment?: string };
  const action = String(body?.action ?? "").trim();
  const comment = String(body?.comment ?? "").trim();

  if (action !== "cancel") {
    return jsonError("INVALID_ACTION", "Неверное действие.", null, 400);
  }

  const clientIds = session.clients.map((item) => item.clientId);
  const accountIds = session.clients.map((item) => item.accountId);
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      clientId: { in: clientIds },
      accountId: resolved.accountId ?? { in: accountIds },
    },
    select: {
      id: true,
      status: true,
      startAt: true,
      accountId: true,
      account: {
        select: { settings: { select: { cancellationWindowHours: true } } },
      },
    },
  });

  if (!appointment) {
    return jsonError("NOT_FOUND", "Запись не найдена.", null, 404);
  }

  if (
    appointment.status === AppointmentStatus.CANCELLED ||
    appointment.status === AppointmentStatus.DONE ||
    appointment.status === AppointmentStatus.NO_SHOW
  ) {
    return jsonError("ALREADY_CLOSED", "Запись уже завершена или отменена.", null, 400);
  }

  const now = new Date();
  if (appointment.startAt <= now) {
    return jsonError("PAST_TIME", "Нельзя отменить прошедшую запись.", null, 400);
  }

  const cancellationWindowHours = appointment.account.settings?.cancellationWindowHours ?? null;
  if (cancellationWindowHours != null) {
    const deadline = new Date(appointment.startAt);
    deadline.setHours(deadline.getHours() - cancellationWindowHours);
    if (now > deadline) {
      return jsonError(
        "CANCEL_WINDOW",
        "Отмена недоступна: осталось слишком мало времени.",
        { cancellationWindowHours },
        400
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.CANCELLED },
    });
    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        actorType: "client",
        actorId: null,
        fromStatus: appointment.status,
        toStatus: AppointmentStatus.CANCELLED,
        comment: comment || null,
      },
    });
  });

  return jsonOk({ id: appointment.id, status: AppointmentStatus.CANCELLED });
}
