import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";

const toText = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
};

export async function GET() {
  const session = await requireCrmPermission("crm.settings.read");

  const profile = await prisma.accountProfile.findUnique({
    where: { accountId: session.accountId },
  });

  return NextResponse.json({
    data: {
      description: profile?.description ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      address: profile?.address ?? "",
      websiteUrl: profile?.websiteUrl ?? "",
      instagramUrl: profile?.instagramUrl ?? "",
      whatsappUrl: profile?.whatsappUrl ?? "",
      telegramUrl: profile?.telegramUrl ?? "",
      maxUrl: profile?.maxUrl ?? "",
      vkUrl: profile?.vkUrl ?? "",
      viberUrl: profile?.viberUrl ?? "",
      pinterestUrl: profile?.pinterestUrl ?? "",
    },
  });
}

export async function PATCH(request: Request) {
  const session = await requireCrmPermission("crm.settings.update");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  }

  const data = {
    description: toText(body.description),
    phone: toText(body.phone),
    email: toText(body.email),
    address: toText(body.address),
    websiteUrl: toText(body.websiteUrl),
    instagramUrl: toText(body.instagramUrl),
    whatsappUrl: toText(body.whatsappUrl),
    telegramUrl: toText(body.telegramUrl),
    maxUrl: toText(body.maxUrl),
    vkUrl: toText(body.vkUrl),
    viberUrl: toText(body.viberUrl),
    pinterestUrl: toText(body.pinterestUrl),
  };

  const updated = await prisma.accountProfile.upsert({
    where: { accountId: session.accountId },
    create: { accountId: session.accountId, ...data },
    update: data,
  });

  return NextResponse.json({
    data: {
      description: updated.description ?? "",
      phone: updated.phone ?? "",
      email: updated.email ?? "",
      address: updated.address ?? "",
      websiteUrl: updated.websiteUrl ?? "",
      instagramUrl: updated.instagramUrl ?? "",
      whatsappUrl: updated.whatsappUrl ?? "",
      telegramUrl: updated.telegramUrl ?? "",
      maxUrl: updated.maxUrl ?? "",
      vkUrl: updated.vkUrl ?? "",
      viberUrl: updated.viberUrl ?? "",
      pinterestUrl: updated.pinterestUrl ?? "",
    },
  });
}
