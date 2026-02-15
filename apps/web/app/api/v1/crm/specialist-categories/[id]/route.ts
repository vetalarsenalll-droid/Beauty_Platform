import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };

const CYR_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

function toSlug(input: string) {
  const lower = input.trim().toLowerCase();
  const translit = Array.from(lower)
    .map((ch) => CYR_MAP[ch] ?? ch)
    .join("");
  const slug = translit
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "category";
}

async function ensureUniqueSlug(accountId: number, base: string, excludeId: number) {
  let slug = base;
  let i = 2;
  while (
    await prisma.specialistCategory.findFirst({
      where: { accountId, slug, id: { not: excludeId } },
      select: { id: true },
    })
  ) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function parseCategoryId(raw: string) {
  const categoryId = Number(raw);
  if (!Number.isInteger(categoryId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id категории.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { categoryId };
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.specialists.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseCategoryId(id);
  if ("error" in parsed) return parsed.error;

  const category = await prisma.specialistCategory.findUnique({
    where: { id: parsed.categoryId },
  });

  if (!category || category.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Категория не найдена.", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректный формат запроса.", null, 400);
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return jsonError(
      "VALIDATION_FAILED",
      "Название обязательно.",
      { fields: [{ path: "name", issue: "required" }] },
      400
    );
  }

  try {
    const baseSlug = toSlug(name);
    const slug = await ensureUniqueSlug(auth.session.accountId, baseSlug, category.id);

    const updated = await prisma.specialistCategory.update({
      where: { id: category.id },
      data: { name, slug },
    });

    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Обновил категорию специалиста",
      targetType: "specialist_category",
      targetId: updated.id,
      diffJson: { name, slug },
    });

    const response = jsonOk({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      createdAt: updated.createdAt.toISOString(),
    });
    return applyCrmAccessCookie(response, auth);
  } catch {
    return jsonError("SERVER_ERROR", "Не удалось обновить категорию.", null, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.specialists.delete");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseCategoryId(id);
  if ("error" in parsed) return parsed.error;

  const category = await prisma.specialistCategory.findUnique({
    where: { id: parsed.categoryId },
  });

  if (!category || category.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Категория не найдена.", null, 404);
  }

  const linked = await prisma.specialistCategoryLink.count({
    where: { categoryId: category.id },
  });
  if (linked > 0) {
    return jsonError(
      "CONFLICT",
      "Категория используется в карточках специалистов.",
      null,
      409
    );
  }

  await prisma.specialistCategory.delete({
    where: { id: category.id },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удалил категорию специалиста",
    targetType: "specialist_category",
    targetId: category.id,
  });

  const response = jsonOk({ id: category.id });
  return applyCrmAccessCookie(response, auth);
}

