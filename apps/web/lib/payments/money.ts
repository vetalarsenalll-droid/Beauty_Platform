import { Prisma } from "@prisma/client";

export function rubToKopecks(value: unknown) {
  const decimal = new Prisma.Decimal(value == null ? 0 : String(value));
  return decimal.mul(100).round().toNumber();
}

export function decimalToNumber(value: unknown) {
  return Number(value ?? 0);
}
