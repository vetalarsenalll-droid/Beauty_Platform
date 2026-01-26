import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";

export type PublicAccount = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
};

type ResolveResult =
  | { account: PublicAccount; response?: undefined }
  | { account?: undefined; response: Response };

function normalizeHost(host: string | null) {
  if (!host) return "";
  const value = host.split(",")[0]?.trim().toLowerCase();
  return value ? value.replace(/:\d+$/, "") : "";
}

export async function resolvePublicAccount(
  request: Request
): Promise<ResolveResult> {
  const { searchParams } = new URL(request.url);
  const accountSlug = String(searchParams.get("account") ?? "").trim();
  const hostHeader =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = normalizeHost(hostHeader);

  let account =
    accountSlug.length > 0
      ? await prisma.account.findFirst({
          where: { slug: accountSlug },
          select: { id: true, name: true, slug: true, timeZone: true },
        })
      : null;

  if (!account && host && host !== "localhost" && host !== "127.0.0.1") {
    const domain = await prisma.accountDomain.findFirst({
      where: { domain: host },
      include: { account: true },
    });
    if (domain?.account) {
      account = {
        id: domain.account.id,
        name: domain.account.name,
        slug: domain.account.slug,
        timeZone: domain.account.timeZone,
      };
    }
  }

  if (!account) {
    return {
      response: jsonError(
        "ACCOUNT_NOT_FOUND",
        "Аккаунт не найден.",
        null,
        404
      ),
    };
  }

  return { account };
}

export function parseUtcDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function toMinutes(value: string) {
  const [h, m] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(hours)}:${pad2(minutes)}`;
}

export function toLocalMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}
