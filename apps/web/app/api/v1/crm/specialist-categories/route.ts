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

async function ensureUniqueSlug(accountId: number, base: string) {
  let slug = base;
  let i = 2;
  while (
    await prisma.specialistCategory.findFirst({
      where: { accountId, slug },
      select: { id: true },
    })
  ) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

export async function GET() {
  const auth = await requireCrmApiPermission("crm.specialists.read");
  if ("response" in auth) return auth.response;

  const categories = await prisma.specialistCategory.findMany({
    where: { accountId: auth.session.accountId },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(
    categories.map((category) => mapCategory(category as DbCategory))
  );
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.specialists.create");
  if ("response" in auth) return auth.response;

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
    const slug = await ensureUniqueSlug(auth.session.accountId, baseSlug);

    const created = await prisma.specialistCategory.create({
      data: {
        accountId: auth.session.accountId,
        name,
        slug,
      },
    });

    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Создал категорию специалиста",
      targetType: "specialist_category",
      targetId: created.id,
      diffJson: { name, slug },
    });

    const response = jsonOk(mapCategory(created as DbCategory), 201);
    return applyCrmAccessCookie(response, auth);
  } catch {
    return jsonError("SERVER_ERROR", "Не удалось создать категорию.", null, 500);
  }
}

