import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };

function parseCategoryId(raw: string) {
  const categoryId = Number(raw);
  if (!Number.isInteger(categoryId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id категории",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { categoryId };
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.services.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseCategoryId(id);
  if ("error" in parsed) return parsed.error;

  const category = await prisma.serviceCategory.findUnique({
    where: { id: parsed.categoryId },
  });

  if (!category || category.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Категория не найдена", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректный формат запроса",
      null,
      400
    );
  }

  const data: { name?: string; slug?: string } = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.slug !== undefined) data.slug = String(body.slug).trim();

  try {
    const updated = await prisma.serviceCategory.update({
      where: { id: category.id },
      data,
    });

    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Обновление категории услуги",
      targetType: "service_category",
      targetId: updated.id,
      diffJson: data,
    });

    const response = jsonOk({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      createdAt: updated.createdAt.toISOString(),
    });
    return applyCrmAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("DUPLICATE", "Slug уже используется", { field: "slug" }, 409);
    }
    return jsonError("SERVER_ERROR", "Не удалось обновить категорию", null, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.services.delete");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseCategoryId(id);
  if ("error" in parsed) return parsed.error;

  const category = await prisma.serviceCategory.findUnique({
    where: { id: parsed.categoryId },
  });

  if (!category || category.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Категория не найдена", null, 404);
  }

  await prisma.serviceCategory.delete({ where: { id: category.id } });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удаление категории услуги",
    targetType: "service_category",
    targetId: category.id,
    diffJson: { id: category.id },
  });

  const response = jsonOk({ id: category.id });
  return applyCrmAccessCookie(response, auth);
}
