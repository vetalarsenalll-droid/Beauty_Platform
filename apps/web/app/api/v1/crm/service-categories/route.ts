import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type DbCategory = {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
};

function mapCategory(category: DbCategory) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    createdAt: category.createdAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requireCrmApiPermission("crm.services.read");
  if ("response" in auth) return auth.response;

  const categories = await prisma.serviceCategory.findMany({
    where: { accountId: auth.session.accountId },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(
    categories.map((category) => mapCategory(category as DbCategory))
  );
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.services.create");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректный формат запроса",
      null,
      400
    );
  }

  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim();

  if (!name || !slug) {
    return jsonError(
      "VALIDATION_FAILED",
      "Название и slug обязательны",
      {
        fields: [
          { path: "name", issue: name ? null : "required" },
          { path: "slug", issue: slug ? null : "required" },
        ],
      },
      400
    );
  }

  try {
    const created = await prisma.serviceCategory.create({
      data: {
        accountId: auth.session.accountId,
        name,
        slug,
      },
    });

    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Создание категории услуги",
      targetType: "service_category",
      targetId: created.id,
      diffJson: { name, slug },
    });

    const response = jsonOk(mapCategory(created as DbCategory), 201);
    return applyCrmAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("DUPLICATE", "Slug уже используется", { field: "slug" }, 409);
    }
    return jsonError("SERVER_ERROR", "Не удалось создать категорию", null, 500);
  }
}
