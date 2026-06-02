import crypto from "crypto";

const KEY_ENV = "ACCOUNT_PAYMENT_CREDENTIALS_ENCRYPTION_KEY";
const VERSION = "v1";

function getEncryptionKey() {
  const raw = process.env[KEY_ENV]?.trim();
  if (!raw) {
    throw new Error(`${KEY_ENV} is required to encrypt account payment credentials`);
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall through to passphrase hashing for local development.
  }

  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptJson(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptJson<T>(encryptedValue: string): T {
  const [version, ivRaw, tagRaw, encryptedRaw] = encryptedValue.split(":");
  if (version !== VERSION || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Unsupported encrypted account payment credentials format");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}

