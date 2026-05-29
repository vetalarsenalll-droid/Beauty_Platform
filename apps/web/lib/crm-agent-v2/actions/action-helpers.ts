import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type JsonRecord = Record<string, unknown>;

export function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export function requiredString(payload: JsonRecord, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Action payload ${key} is required.`);
  return value.trim();
}

export function optionalString(payload: JsonRecord, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : null;
}

export function requiredNumber(value: unknown, key: string) {
  const parsed = numberOrNull(value);
  if (parsed == null) throw new Error(`Action payload ${key} is required.`);
  return parsed;
}

export function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function optionalBoolean(payload: JsonRecord, key: string) {
  const value = payload[key];
  return typeof value === "boolean" ? value : null;
}

export function optionalDate(payload: JsonRecord, key: string) {
  const value = optionalString(payload, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Action payload ${key} must be a valid date.`);
  return date;
}

export function requiredDate(payload: JsonRecord, key: string) {
  const date = optionalDate(payload, key);
  if (!date) throw new Error(`Action payload ${key} is required.`);
  return date;
}

export async function assertClientBelongsToAccount(accountId: number, clientId: number) {
  const client = await prisma.client.findFirst({ where: { id: clientId, accountId }, select: { id: true } });
  if (!client) throw new Error("Client not found.");
}

export async function assertSpecialistBelongsToAccount(accountId: number, specialistId: number) {
  const specialist = await prisma.specialistProfile.findFirst({ where: { id: specialistId, accountId }, select: { id: true } });
  if (!specialist) throw new Error("Specialist not found.");
}

export async function assertLocationBelongsToAccount(accountId: number, locationId: number) {
  const location = await prisma.location.findFirst({ where: { id: locationId, accountId }, select: { id: true } });
  if (!location) throw new Error("Location not found.");
}

export async function assertServiceCategoryBelongsToAccount(accountId: number, categoryId: number) {
  const category = await prisma.serviceCategory.findFirst({
    where: { id: categoryId, OR: [{ accountId }, { accountId: null }] },
    select: { id: true },
  });
  if (!category) throw new Error("Service category not found.");
}

export async function assertServiceSpecialistBinding(serviceId: number, specialistId: number) {
  const binding = await prisma.specialistService.findFirst({ where: { serviceId, specialistId }, select: { specialistId: true } });
  if (!binding) throw new Error("Specialist is not assigned to service.");
}

export async function assertServiceLocationBinding(serviceId: number, locationId: number) {
  const binding = await prisma.serviceLocation.findFirst({ where: { serviceId, locationId }, select: { locationId: true } });
  if (!binding) throw new Error("Service is not available at location.");
}
