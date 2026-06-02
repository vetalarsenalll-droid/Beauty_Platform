import { decryptJson, encryptJson } from "./encryption";
import type {
  AccountPaymentCredentials,
  AccountPaymentProviderCode,
  AlfaCredentials,
  SberCredentials,
  TbankCredentials,
  YooKassaCredentials,
} from "./types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Credentials payload must be an object");
  }
  return value as JsonRecord;
}

function requiredString(record: JsonRecord, key: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Payment credential "${key}" is required`);
  }
  return value.trim();
}

function optionalString(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function maskSecret(value: string) {
  if (value.length <= 6) return "*".repeat(value.length);
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function normalizeYooKassa(record: JsonRecord): YooKassaCredentials {
  return {
    provider: "yookassa",
    shopId: requiredString(record, "shopId"),
    secretKey: requiredString(record, "secretKey"),
  };
}

function normalizeTbank(record: JsonRecord): TbankCredentials {
  return {
    provider: "tbank",
    terminalKey: requiredString(record, "terminalKey"),
    password: requiredString(record, "password"),
    apiUrl: optionalString(record, "apiUrl"),
  };
}

function normalizeSber(record: JsonRecord): SberCredentials {
  const gatewayVersion = optionalString(record, "gatewayVersion");
  return {
    provider: "sber",
    apiLogin: requiredString(record, "apiLogin"),
    apiPassword: requiredString(record, "apiPassword"),
    apiUrl: optionalString(record, "apiUrl"),
    gatewayVersion: gatewayVersion === "v1" ? "v1" : "legacy",
  };
}

function normalizeAlfa(record: JsonRecord): AlfaCredentials {
  return {
    provider: "alfa",
    apiLogin: requiredString(record, "apiLogin"),
    apiPassword: requiredString(record, "apiPassword"),
    apiUrl: optionalString(record, "apiUrl"),
  };
}

export function normalizeAccountPaymentCredentials(
  provider: AccountPaymentProviderCode,
  raw: unknown,
): AccountPaymentCredentials {
  const record = asRecord(raw);
  switch (provider) {
    case "yookassa":
      return normalizeYooKassa(record);
    case "tbank":
      return normalizeTbank(record);
    case "sber":
      return normalizeSber(record);
    case "alfa":
      return normalizeAlfa(record);
  }
}

export function maskAccountPaymentCredentials(credentials: AccountPaymentCredentials): JsonRecord {
  switch (credentials.provider) {
    case "yookassa":
      return { shopId: credentials.shopId, secretKey: maskSecret(credentials.secretKey) };
    case "tbank":
      return {
        terminalKey: credentials.terminalKey,
        password: maskSecret(credentials.password),
        apiUrl: credentials.apiUrl ?? null,
      };
    case "sber":
      return {
        apiLogin: credentials.apiLogin,
        apiPassword: maskSecret(credentials.apiPassword),
        apiUrl: credentials.apiUrl ?? null,
        gatewayVersion: credentials.gatewayVersion ?? "legacy",
      };
    case "alfa":
      return {
        apiLogin: credentials.apiLogin,
        apiPassword: maskSecret(credentials.apiPassword),
        apiUrl: credentials.apiUrl ?? null,
      };
  }
}

export function encryptAccountPaymentCredentials(credentials: AccountPaymentCredentials) {
  return encryptJson(credentials);
}

export function decryptAccountPaymentCredentials(encryptedValue: string) {
  const credentials = decryptJson<AccountPaymentCredentials>(encryptedValue);
  return normalizeAccountPaymentCredentials(credentials.provider, credentials);
}

