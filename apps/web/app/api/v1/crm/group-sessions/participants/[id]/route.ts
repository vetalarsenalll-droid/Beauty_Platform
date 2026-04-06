import { NextResponse } from "next/server";
import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const isAppointmentStatus = (value: unknown): value is AppointmentStatus =>
  typeof value === "string" &&
  (Object.values(AppointmentStatus) as string[]).includes(value);

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireCrmPermission("crm.calendar.read");

  const { id } = await params;
  const participantId = Number(id);
  if (!Number.isInteger(participantId)) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const status = isAppointmentStatus(body?.status) ? body.status : null;
  if (!status) {
    return NextResponse.json({ message: "INVALID_STATUS" }, { status: 400 });
  }

  const participant = await prisma.groupSessionParticipant.findFirst({
    where: {
      id: participantId,
      groupSession: { accountId: session.accountId },
    },
    select: { id: true },
  });

  if (!participant) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  const updated = await prisma.groupSessionParticipant.update({
    where: { id: participantId },
    data: { status },
    select: { id: true, status: true },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
