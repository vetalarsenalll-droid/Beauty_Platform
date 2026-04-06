import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";

const toNum = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const toStr = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await requireCrmPermission("crm.calendar.read");
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ message: "INVALID_BODY" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;
  const clientId = toNum(body.clientId);
  const price = toStr(body.price);
  if (!clientId || !Number.isInteger(clientId)) {
    return NextResponse.json({ message: "INVALID_CLIENT" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const groupSession = await tx.groupSession.findFirst({
      where: { id: sessionId, accountId: session.accountId },
    });
    if (!groupSession) return { error: "NOT_FOUND" as const };
    if (groupSession.status === "CANCELLED") return { error: "CANCELLED" as const };
    if (groupSession.bookedCount >= groupSession.capacity) {
      return { error: "SESSION_FULL" as const };
    }

    const existing = await tx.groupSessionParticipant.findFirst({
      where: { groupSessionId: groupSession.id, clientId },
    });
    if (existing) return { error: "ALREADY_EXISTS" as const };

    const participant = await tx.groupSessionParticipant.create({
      data: {
        groupSessionId: groupSession.id,
        clientId,
        price: price || null,
        status: "NEW",
      },
    });

    await tx.groupSession.update({
      where: { id: groupSession.id },
      data: { bookedCount: groupSession.bookedCount + 1 },
    });

    return { participant };
  });

  if ("error" in result) {
    return NextResponse.json({ message: result.error }, { status: 409 });
  }

  return NextResponse.json({ id: result.participant.id });
}
