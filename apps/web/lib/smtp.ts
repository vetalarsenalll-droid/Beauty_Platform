import nodemailer from "nodemailer";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

let cachedConfig: SmtpConfig | null | undefined;
let cachedTransporter: nodemailer.Transporter | null | undefined;

function parseBoolean(raw: string | undefined, fallback: boolean) {
  if (!raw) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

export function getSmtpConfig(): SmtpConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const host = String(process.env.SMTP_HOST ?? "").trim();
  const user = String(process.env.SMTP_USER ?? "").trim();
  const pass = String(process.env.SMTP_PASS ?? "").trim();
  const fromEmail = String(process.env.SMTP_FROM ?? "").trim();
  const fromName = String(process.env.SMTP_FROM_NAME ?? "ONLAIS").trim();
  const portRaw = String(process.env.SMTP_PORT ?? "").trim();
  const port = Number(portRaw || "587");
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);

  if (!host || !user || !pass || !fromEmail || !Number.isFinite(port) || port <= 0) {
    cachedConfig = null;
    return cachedConfig;
  }

  cachedConfig = {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
  };
  return cachedConfig;
}

function getTransporter() {
  if (cachedTransporter !== undefined) return cachedTransporter;
  const config = getSmtpConfig();
  if (!config) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
  return cachedTransporter;
}

export async function sendRegisterOtpEmail(input: {
  to: string;
  code: string;
  expiresAt: Date;
}) {
  const config = getSmtpConfig();
  const transporter = getTransporter();

  if (!config || !transporter) {
    const error = new Error("SMTP_NOT_CONFIGURED");
    (error as Error & { code?: string }).code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  const ttlMinutes = Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 60000));

  const subject = "Код подтверждения регистрации ONLAIS";
  const text = [
    "Код подтверждения регистрации в ONLAIS:",
    "",
    input.code,
    "",
    `Код действует ${ttlMinutes} мин.`,
    "Если вы не запрашивали регистрацию, просто игнорируйте это письмо.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
      <p>Код подтверждения регистрации в ONLAIS:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:2px;margin:16px 0;">${input.code}</p>
      <p>Код действует ${ttlMinutes} мин.</p>
      <p style="color:#6B7280;">Если вы не запрашивали регистрацию, просто игнорируйте это письмо.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: input.to,
    subject,
    text,
    html,
  });
}
