import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CrmAgentCandidate, CrmAgentSlot, CrmAgentSlotStatus } from "./types";

export type CrmAgentResolvableEntity =
  | "client"
  | "service"
  | "specialist"
  | "location"
  | "appointment"
  | "promotion"
  | "review"
  | "memory";

export type CrmAgentResolverResult = {
  entity: CrmAgentResolvableEntity;
  query: string | null;
  status: CrmAgentSlotStatus;
  candidates: CrmAgentCandidate[];
  selected?: CrmAgentCandidate;
  reason?: string;
};

export type CrmAgentResolverContext = {
  accountId: number;
  now?: Date;
};

type ResolveArgs = {
  query?: string | null;
  id?: number | string | null;
  take?: number;
  filters?: Record<string, unknown>;
};

const DEFAULT_TAKE = 8;

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(query: string | null | undefined) {
  return normalizeText(query)
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .slice(0, 6);
}

function comparableToken(value: string) {
  return value.replace(/[\u044c\u0430\u0435\u0443\u044b\u043e\u0438\u044e\u044f]+$/iu, "");
}

function scoreLabels(query: string | null | undefined, labels: Array<string | null | undefined>) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const joined = labels.map(normalizeText).filter(Boolean).join(" ");
  if (!joined) return Number.POSITIVE_INFINITY;
  if (joined === normalizedQuery) return 0;
  if (joined.includes(normalizedQuery)) return 0.2;

  const candidateTokens = new Set(joined.split(/\s+/).filter((token) => token.length >= 2));
  const tokens = searchTokens(normalizedQuery);
  if (!tokens.length) return Number.POSITIVE_INFINITY;

  let misses = 0;
  for (const token of tokens) {
    const comparableQuery = comparableToken(token);
    const hasMatch = [...candidateTokens].some(
      (candidate) => {
        const comparableCandidate = comparableToken(candidate);
        return (
          candidate === token ||
          candidate.includes(token) ||
          (candidate.length >= 4 && token.includes(candidate)) ||
          (comparableQuery.length >= 4 && comparableCandidate.length >= 4 && comparableCandidate === comparableQuery)
        );
      },
    );
    if (!hasMatch) misses += 1;
  }
  return misses === tokens.length ? Number.POSITIVE_INFINITY : misses + tokens.length * 0.1;
}

function takeValue(value: number | undefined) {
  return Math.min(Math.max(Math.trunc(value ?? DEFAULT_TAKE), 1), 50);
}

function candidateFetchTake(args: ResolveArgs) {
  return args.query ? Math.min(takeValue(args.take) * 20, 300) : takeValue(args.take);
}

function rankCandidates<T>(
  items: T[],
  args: ResolveArgs,
  labels: (item: T) => Array<string | null | undefined>,
  toCandidate: (item: T) => CrmAgentCandidate,
) {
  const take = takeValue(args.take);
  if (!normalizeText(args.query)) return items.slice(0, take).map(toCandidate);

  return items
    .map((item, index) => ({ item, index, score: scoreLabels(args.query, labels(item)) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, take)
    .map((item) => toCandidate(item.item));
}

function result(entity: CrmAgentResolvableEntity, args: ResolveArgs, candidates: CrmAgentCandidate[]): CrmAgentResolverResult {
  if (!args.query && args.id == null && !isListAllRequest(args)) {
    return { entity, query: null, status: "empty", candidates: [], reason: "missing_query" };
  }
  if (isListAllRequest(args)) {
    return { entity, query: null, status: candidates.length ? "resolved" : "not_found", candidates };
  }
  if (!candidates.length) {
    return { entity, query: args.query ?? null, status: "not_found", candidates };
  }
  if (candidates.length === 1) {
    return { entity, query: args.query ?? null, status: "resolved", candidates, selected: candidates[0] };
  }
  return { entity, query: args.query ?? null, status: "ambiguous", candidates };
}

function isListAllRequest(args: ResolveArgs) {
  return args.filters?.all === true || args.filters?.listAll === true;
}

function money(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : value.toString();
}

function numberId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function dateArg(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function resolveCrmAgentClient(ctx: CrmAgentResolverContext, args: ResolveArgs): Promise<CrmAgentResolverResult> {
  const id = numberId(args.id);
  const clients = await prisma.client.findMany({
    where: {
      accountId: ctx.accountId,
      ...(id ? { id } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: id ? 1 : candidateFetchTake(args),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      updatedAt: true,
      tags: { select: { tag: { select: { name: true } } }, take: 10 },
    },
  });

  const candidates = rankCandidates(
    clients,
    args,
    (client) => [
      client.firstName,
      client.lastName,
      [client.firstName, client.lastName].filter(Boolean).join(" "),
      client.phone,
      client.email,
      ...client.tags.map((item) => item.tag.name),
    ],
    (client) => {
      const title = [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || `Client #${client.id}`;
      return {
        type: "client",
        id: client.id,
        title,
        subtitle: [client.phone, client.email].filter(Boolean).join(" | ") || null,
        data: {
          phone: client.phone,
          email: client.email,
          tags: client.tags.map((item) => item.tag.name),
          updatedAt: client.updatedAt.toISOString(),
        },
      };
    },
  );
  return result("client", args, candidates);
}

export async function resolveCrmAgentService(ctx: CrmAgentResolverContext, args: ResolveArgs): Promise<CrmAgentResolverResult> {
  const id = numberId(args.id);
  const services = await prisma.service.findMany({
    where: {
      accountId: ctx.accountId,
      ...(id ? { id } : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: id ? 1 : candidateFetchTake(args),
    select: {
      id: true,
      name: true,
      description: true,
      searchKeywords: true,
      synonyms: true,
      baseDurationMin: true,
      basePrice: true,
      isActive: true,
      category: { select: { id: true, name: true } },
      specialists: { select: { specialistId: true }, take: 50 },
      locations: { select: { locationId: true }, take: 50 },
    },
  });

  const candidates = rankCandidates(
    services,
    args,
    (service) => [service.name, service.description, service.searchKeywords, service.synonyms, service.category?.name],
    (service) => ({
      type: "service",
      id: service.id,
      title: service.name,
      subtitle: [money(service.basePrice), `${service.baseDurationMin} мин`, service.category?.name].filter(Boolean).join(" | "),
      data: {
        description: service.description,
        categoryId: service.category?.id ?? null,
        categoryName: service.category?.name ?? null,
        baseDurationMin: service.baseDurationMin,
        basePrice: money(service.basePrice),
        isActive: service.isActive,
        specialistIds: service.specialists.map((item) => item.specialistId),
        locationIds: service.locations.map((item) => item.locationId),
      },
    }),
  );
  return result("service", args, candidates);
}

export async function resolveCrmAgentSpecialist(ctx: CrmAgentResolverContext, args: ResolveArgs): Promise<CrmAgentResolverResult> {
  const id = numberId(args.id);
  const serviceId = numberId(args.filters?.serviceId);
  const locationId = numberId(args.filters?.locationId);
  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: ctx.accountId,
      ...(id ? { id } : {}),
      ...(serviceId ? { services: { some: { serviceId } } } : {}),
      ...(locationId ? { locations: { some: { locationId } } } : {}),
    },
    orderBy: [{ isPublic: "desc" }, { createdAt: "desc" }],
    take: id ? 1 : candidateFetchTake(args),
    select: {
      id: true,
      bio: true,
      isPublic: true,
      user: { select: { profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      services: { select: { service: { select: { id: true, name: true } } }, take: 50 },
      locations: { select: { location: { select: { id: true, name: true } } }, take: 50 },
    },
  });

  const candidates = rankCandidates(
    specialists,
    args,
    (specialist) => [
      specialist.user.profile?.firstName,
      specialist.user.profile?.lastName,
      [specialist.user.profile?.firstName, specialist.user.profile?.lastName].filter(Boolean).join(" "),
      specialist.bio,
      ...specialist.services.map((item) => item.service.name),
      ...specialist.locations.map((item) => item.location.name),
    ],
    (specialist) => {
      const profile = specialist.user.profile;
      const title = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || `Specialist #${specialist.id}`;
      return {
        type: "specialist",
        id: specialist.id,
        title,
        subtitle: specialist.services.map((item) => item.service.name).slice(0, 3).join(", ") || null,
        data: {
          bio: specialist.bio,
          isPublic: specialist.isPublic,
          avatarUrl: profile?.avatarUrl ?? null,
          services: specialist.services.map((item) => item.service),
          locations: specialist.locations.map((item) => item.location),
        },
      };
    },
  );
  return result("specialist", args, candidates);
}

export async function resolveCrmAgentLocation(ctx: CrmAgentResolverContext, args: ResolveArgs): Promise<CrmAgentResolverResult> {
  const id = numberId(args.id);
  const locations = await prisma.location.findMany({
    where: {
      accountId: ctx.accountId,
      ...(id ? { id } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: id ? 1 : candidateFetchTake(args),
    select: {
      id: true,
      name: true,
      address: true,
      description: true,
      phone: true,
      status: true,
    },
  });

  const candidates = rankCandidates(
    locations,
    args,
    (location) => [location.name, location.address, location.description, location.phone],
    (location) => ({
      type: "location",
      id: location.id,
      title: location.name,
      subtitle: location.address || location.phone || null,
      data: {
        address: location.address,
        description: location.description,
        phone: location.phone,
        status: location.status,
      },
    }),
  );
  return result("location", args, candidates);
}

export async function resolveCrmAgentAppointment(ctx: CrmAgentResolverContext, args: ResolveArgs): Promise<CrmAgentResolverResult> {
  const id = numberId(args.id);
  const clientId = numberId(args.filters?.clientId);
  const specialistId = numberId(args.filters?.specialistId);
  const locationId = numberId(args.filters?.locationId);
  const dateFrom = dateArg(args.filters?.dateFrom);
  const dateTo = dateArg(args.filters?.dateTo);
  const appointments = await prisma.appointment.findMany({
    where: {
      accountId: ctx.accountId,
      ...(id ? { id } : {}),
      ...(clientId ? { clientId } : {}),
      ...(specialistId ? { specialistId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(dateFrom || dateTo ? { startAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    },
    orderBy: { startAt: "desc" },
    take: id ? 1 : candidateFetchTake(args),
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      priceTotal: true,
      client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      location: { select: { id: true, name: true } },
      specialist: { select: { id: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      services: { select: { service: { select: { id: true, name: true } } }, take: 10 },
    },
  });

  const candidates = rankCandidates(
    appointments,
    args,
    (appointment) => [
      String(appointment.id),
      appointment.client.firstName,
      appointment.client.lastName,
      appointment.client.phone,
      appointment.location.name,
      appointment.specialist.user.profile?.firstName,
      appointment.specialist.user.profile?.lastName,
      ...appointment.services.map((item) => item.service.name),
    ],
    (appointment) => {
      const clientName = [appointment.client.firstName, appointment.client.lastName].filter(Boolean).join(" ").trim();
      const specialistName = [
        appointment.specialist.user.profile?.firstName,
        appointment.specialist.user.profile?.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        type: "appointment",
        id: appointment.id,
        title: `Appointment #${appointment.id}`,
        subtitle: [appointment.startAt.toISOString(), clientName, appointment.status].filter(Boolean).join(" | "),
        data: {
          startAt: appointment.startAt.toISOString(),
          endAt: appointment.endAt.toISOString(),
          status: appointment.status,
          priceTotal: money(appointment.priceTotal),
          client: { id: appointment.client.id, name: clientName, phone: appointment.client.phone },
          specialist: { id: appointment.specialist.id, name: specialistName },
          location: appointment.location,
          services: appointment.services.map((item) => item.service),
        },
      };
    },
  );
  return result("appointment", args, candidates);
}

export async function resolveCrmAgentMemory(ctx: CrmAgentResolverContext, args: ResolveArgs): Promise<CrmAgentResolverResult> {
  const rows = await prisma.crmAgentMemory.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { updatedAt: "desc" },
    take: candidateFetchTake(args),
    select: { id: true, key: true, value: true, source: true, confidence: true, updatedAt: true },
  });
  const candidates = rankCandidates(
    rows,
    args,
    (memory) => [memory.key, memory.source],
    (memory) => ({
      type: "memory",
      id: memory.id,
      title: memory.key,
      subtitle: memory.source,
      data: {
        value: memory.value,
        confidence: memory.confidence.toString(),
        updatedAt: memory.updatedAt.toISOString(),
      },
    }),
  );
  return result("memory", args, candidates);
}

export async function resolveCrmAgentEntity(
  ctx: CrmAgentResolverContext,
  entity: CrmAgentResolvableEntity,
  args: ResolveArgs,
): Promise<CrmAgentResolverResult> {
  if (entity === "client") return resolveCrmAgentClient(ctx, args);
  if (entity === "service") return resolveCrmAgentService(ctx, args);
  if (entity === "specialist") return resolveCrmAgentSpecialist(ctx, args);
  if (entity === "location") return resolveCrmAgentLocation(ctx, args);
  if (entity === "appointment") return resolveCrmAgentAppointment(ctx, args);
  if (entity === "memory") return resolveCrmAgentMemory(ctx, args);
  return { entity, query: args.query ?? null, status: "not_found", candidates: [], reason: "resolver_not_implemented" };
}

export async function resolveCrmAgentSlot(
  ctx: CrmAgentResolverContext,
  entity: CrmAgentResolvableEntity,
  slot: CrmAgentSlot | undefined,
  filters: Record<string, unknown> = {},
): Promise<CrmAgentResolverResult> {
  return resolveCrmAgentEntity(ctx, entity, {
    query: slot?.query ?? (typeof slot?.value === "string" ? slot.value : null),
    id: slot?.selectedId ?? null,
    filters,
  });
}
