import net from "node:net";
import tls from "node:tls";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BUSY_STATUSES = ["NEW", "CONFIRMED", "IN_PROGRESS", "DONE"];
const LOST_STATUSES = ["CANCELLED", "NO_SHOW"];
const CRM_AGENT_NOTIFICATION_EVENTS = new Set([
  "crm_agent.notification.send",
  "crm_agent.notification.campaign.send",
]);
const DELIVERY_PROVIDER = String(process.env.CRM_DELIVERY_PROVIDER || "local").toLowerCase();
const DELIVERY_HTTP_URL = String(process.env.CRM_DELIVERY_HTTP_URL || "").trim();
const DELIVERY_HTTP_TOKEN = String(process.env.CRM_DELIVERY_HTTP_TOKEN || "").trim();
const DELIVERY_HTTP_TIMEOUT_MS = Math.min(Math.max(Number(process.env.CRM_DELIVERY_HTTP_TIMEOUT_MS || 10000), 1000), 60000);
const DELIVERY_MAX_ATTEMPTS = Math.min(Math.max(Number(process.env.CRM_DELIVERY_MAX_ATTEMPTS || 3), 1), 10);
const DELIVERY_RETRY_BASE_SECONDS = Math.min(Math.max(Number(process.env.CRM_DELIVERY_RETRY_BASE_SECONDS || 60), 5), 3600);
const DELIVERY_SMTP_HOST = String(process.env.CRM_DELIVERY_SMTP_HOST || process.env.SMTP_HOST || "").trim();
const DELIVERY_SMTP_PORT = Math.min(Math.max(Number(process.env.CRM_DELIVERY_SMTP_PORT || process.env.SMTP_PORT || 587), 1), 65535);
const DELIVERY_SMTP_SECURE = String(process.env.CRM_DELIVERY_SMTP_SECURE || process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const DELIVERY_SMTP_USER = String(process.env.CRM_DELIVERY_SMTP_USER || process.env.SMTP_USER || "").trim();
const DELIVERY_SMTP_PASS = String(process.env.CRM_DELIVERY_SMTP_PASS || process.env.SMTP_PASS || "").trim();
const DELIVERY_SMTP_FROM = String(process.env.CRM_DELIVERY_SMTP_FROM || process.env.SMTP_FROM || "").trim();
const DELIVERY_SMTP_FROM_NAME = String(process.env.CRM_DELIVERY_SMTP_FROM_NAME || process.env.SMTP_FROM_NAME || "Beauty Platform").trim();
const DELIVERY_SMSRU_API_ID = String(process.env.CRM_DELIVERY_SMSRU_API_ID || process.env.SMSRU_API_ID || "").trim();
const DELIVERY_SMSRU_API_URL = String(process.env.CRM_DELIVERY_SMSRU_API_URL || "https://sms.ru/sms/send").trim();
const DELIVERY_TELEGRAM_BOT_TOKEN = String(process.env.CRM_DELIVERY_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
const DELIVERY_TELEGRAM_API_URL = String(process.env.CRM_DELIVERY_TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/+$/, "");

class DeliveryProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "DeliveryProviderError";
    this.code = options.code || "PROVIDER_ERROR";
    this.retryable = Boolean(options.retryable);
    this.status = options.status || null;
  }
}

function insightKey(type, scope) {
  return `${type}:${scope}`;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function minutesFromTime(value) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function dayName(day) {
  return new Date(`${day}T12:00:00.000Z`).toLocaleDateString("ru-RU", { weekday: "long" });
}

function percent(value) {
  return Math.round(value * 100);
}

function memoryValueToText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 240 ? `${text.slice(0, 240)}...` : text;
  }
  return "";
}

async function buildMemoryHints(accountId) {
  const memory = await prisma.aiAccountMemory.findMany({
    where: {
      accountId,
      key: { in: ["tone_of_voice", "preferred_offer", "brand_positioning", "audience_notes", "business_focus"] },
    },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: 20,
  });
  const byKey = new Map(memory.map((item) => [item.key, memoryValueToText(item.value)]));
  const businessFocus = byKey.get("business_focus") || "";
  const audienceNotes = byKey.get("audience_notes") || "";
  const recommendationSuffix = [businessFocus ? `Фокус бизнеса: ${businessFocus}.` : "", audienceNotes ? `Учитывайте аудиторию: ${audienceNotes}.` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    tone: byKey.get("tone_of_voice") || "",
    preferredOffer: byKey.get("preferred_offer") || "",
    brandPositioning: byKey.get("brand_positioning") || "",
    audienceNotes,
    businessFocus,
    recommendationSuffix,
  };
}

const complaintPatterns = [
  { key: "waiting", label: "ожидание и задержки", words: ["ждал", "ждала", "ждать", "ожид", "задерж", "опозд"] },
  { key: "price", label: "цена и доплаты", words: ["дорого", "цена", "стоимость", "доплат", "переплат"] },
  { key: "service", label: "общение и сервис", words: ["груб", "хам", "невеж", "администратор", "сервис", "общен"] },
  { key: "quality", label: "качество результата", words: ["качество", "результат", "плохо", "испорт", "передел", "неровн"] },
  { key: "cleanliness", label: "чистота", words: ["гряз", "чист", "стерил", "запах", "пыль"] },
  { key: "pain", label: "дискомфорт или боль", words: ["больно", "боль", "жжет", "жгло", "царап", "порез"] },
  { key: "booking", label: "запись и переносы", words: ["запис", "перенес", "отмен", "окно", "время"] },
];

function recurringComplaintThemes(reviews) {
  return complaintPatterns
    .map((pattern) => {
      const matched = reviews.filter((review) => {
        const comment = review.comment?.toLowerCase() ?? "";
        return pattern.words.some((word) => comment.includes(word));
      });
      return {
        key: pattern.key,
        label: pattern.label,
        count: matched.length,
        reviewIds: matched.map((review) => review.id).slice(0, 8),
        examples: matched
          .map((review) => review.comment?.trim())
          .filter(Boolean)
          .slice(0, 3),
      };
    })
    .filter((theme) => theme.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function jsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}

function numberArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "number" && Number.isFinite(item)) : [];
}

function moneySum(values) {
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function clientName(client) {
  return [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || "клиент";
}

function renderTemplate(text, client) {
  return String(text || "")
    .replace(/\{\{\s*name\s*\}\}/gi, clientName(client))
    .replace(/\{\{\s*firstName\s*\}\}/gi, client.firstName || clientName(client));
}

function normalizeProviderStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (["DELIVERED", "DELIVERY_CONFIRMED", "OK"].includes(status)) return "DELIVERED";
  if (["FAILED", "BOUNCED", "REJECTED", "UNDELIVERED"].includes(status)) return "FAILED";
  return "SENT";
}

function isRetryableStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function nextRetryDate(attempt) {
  const seconds = DELIVERY_RETRY_BASE_SECONDS * Math.pow(2, Math.max(0, attempt - 1));
  return new Date(Date.now() + seconds * 1000);
}

function providerForChannel(channel) {
  if (DELIVERY_PROVIDER === "http") return `http:${channel.toLowerCase()}`;
  if (DELIVERY_PROVIDER === "smtp") return "smtp:email";
  if (DELIVERY_PROVIDER === "smsru") return "smsru:sms";
  if (DELIVERY_PROVIDER === "telegram") return "telegram:bot";
  if (DELIVERY_PROVIDER === "auto") {
    if (channel === "EMAIL" && DELIVERY_SMTP_HOST) return "smtp:email";
    if (channel === "SMS" && DELIVERY_SMSRU_API_ID) return "smsru:sms";
    if (channel === "TELEGRAM" && DELIVERY_TELEGRAM_BOT_TOKEN) return "telegram:bot";
  }
  return `local:${channel.toLowerCase()}`;
}

function smtpEncodeAddress(name, email) {
  const safeEmail = String(email || "").trim();
  const safeName = String(name || "").replace(/"/g, "'").trim();
  return safeName ? `"${safeName}" <${safeEmail}>` : safeEmail;
}

function smtpDotStuff(text) {
  return String(text || "").replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function smtpMessage({ from, to, subject, body }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(String(subject || ""), "utf8").toString("base64")}?=`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${smtpDotStuff(body)}\r\n.`;
}

function readSmtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (/^\d{3} /.test(last)) {
        cleanup();
        const code = Number(last.slice(0, 3));
        resolve({ code, text: buffer.trim() });
      }
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function smtpCommand(socket, command, expectedCodes) {
  if (command) socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new DeliveryProviderError(`SMTP command failed: ${response.text}`, {
      code: `SMTP_${response.code || "ERROR"}`,
      retryable: response.code >= 400 && response.code < 500,
      status: response.code,
    });
  }
  return response;
}

function connectSmtpSocket() {
  return new Promise((resolve, reject) => {
    const socket = DELIVERY_SMTP_SECURE
      ? tls.connect({ host: DELIVERY_SMTP_HOST, port: DELIVERY_SMTP_PORT, servername: DELIVERY_SMTP_HOST })
      : net.connect({ host: DELIVERY_SMTP_HOST, port: DELIVERY_SMTP_PORT });
    const onError = (error) => {
      socket.destroy();
      reject(error);
    };
    socket.once("error", onError);
    socket.once("connect", () => {
      socket.off("error", onError);
      resolve(socket);
    });
  });
}

function upgradeSmtpStartTls(socket) {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: DELIVERY_SMTP_HOST }, () => resolve(secureSocket));
    secureSocket.once("error", reject);
  });
}

async function sendSmtpProviderMessage(message) {
  if (message.channel !== "EMAIL") {
    throw new DeliveryProviderError("SMTP provider supports EMAIL channel only.", { code: "UNSUPPORTED_CHANNEL", retryable: false });
  }
  if (!DELIVERY_SMTP_HOST || !DELIVERY_SMTP_FROM) {
    throw new DeliveryProviderError("CRM delivery SMTP host/from is not configured.", { code: "PROVIDER_NOT_CONFIGURED", retryable: false });
  }
  if (!message.target || !String(message.target).includes("@")) {
    throw new DeliveryProviderError("Client email target is missing.", { code: "NO_TARGET", retryable: false });
  }

  let socket;
  try {
    socket = await connectSmtpSocket();
    await smtpCommand(socket, null, [220]);
    await smtpCommand(socket, "EHLO beauty-platform.local", [250]);
    if (!DELIVERY_SMTP_SECURE && DELIVERY_SMTP_PORT !== 25) {
      await smtpCommand(socket, "STARTTLS", [220]);
      socket = await upgradeSmtpStartTls(socket);
      await smtpCommand(socket, "EHLO beauty-platform.local", [250]);
    }
    if (DELIVERY_SMTP_USER || DELIVERY_SMTP_PASS) {
      await smtpCommand(socket, "AUTH LOGIN", [334]);
      await smtpCommand(socket, Buffer.from(DELIVERY_SMTP_USER, "utf8").toString("base64"), [334]);
      await smtpCommand(socket, Buffer.from(DELIVERY_SMTP_PASS, "utf8").toString("base64"), [235]);
    }
    await smtpCommand(socket, `MAIL FROM:<${DELIVERY_SMTP_FROM}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${message.target}>`, [250, 251]);
    await smtpCommand(socket, "DATA", [354]);
    await smtpCommand(
      socket,
      smtpMessage({
        from: smtpEncodeAddress(DELIVERY_SMTP_FROM_NAME, DELIVERY_SMTP_FROM),
        to: message.target,
        subject: message.title,
        body: message.body,
      }),
      [250],
    );
    socket.write("QUIT\r\n");
  } catch (error) {
    if (error instanceof DeliveryProviderError) throw error;
    throw new DeliveryProviderError(error instanceof Error ? error.message : "SMTP provider failed.", {
      code: "SMTP_ERROR",
      retryable: true,
    });
  } finally {
    socket?.destroy();
  }

  return {
    provider: "smtp:email",
    providerMessageId: `smtp-crm-agent-${message.outboxItemId}-${message.clientId}-${Date.now()}`,
    status: "SENT",
    raw: { host: DELIVERY_SMTP_HOST, port: DELIVERY_SMTP_PORT },
  };
}

async function sendSmsRuProviderMessage(message) {
  if (message.channel !== "SMS") {
    throw new DeliveryProviderError("SMS.ru provider supports SMS channel only.", { code: "UNSUPPORTED_CHANNEL", retryable: false });
  }
  if (!DELIVERY_SMSRU_API_ID) {
    throw new DeliveryProviderError("CRM_DELIVERY_SMSRU_API_ID is not configured.", { code: "PROVIDER_NOT_CONFIGURED", retryable: false });
  }
  if (!message.target) {
    throw new DeliveryProviderError("Client phone target is missing.", { code: "NO_TARGET", retryable: false });
  }

  const body = new URLSearchParams({
    api_id: DELIVERY_SMSRU_API_ID,
    to: String(message.target).replace(/[^\d+]/g, ""),
    msg: String(message.body || ""),
    json: "1",
  });
  const response = await fetch(DELIVERY_SMSRU_API_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  }).catch((error) => {
    throw new DeliveryProviderError(error instanceof Error ? error.message : "SMS.ru request failed.", {
      code: "SMSRU_NETWORK_ERROR",
      retryable: true,
    });
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new DeliveryProviderError(`SMS.ru returned HTTP ${response.status}.`, {
      code: `SMSRU_HTTP_${response.status}`,
      retryable: isRetryableStatus(response.status),
      status: response.status,
    });
  }
  const smsInfo = payload?.sms && typeof payload.sms === "object" ? Object.values(payload.sms)[0] : null;
  const ok = payload?.status === "OK" && (!smsInfo || smsInfo.status === "OK");
  if (!ok) {
    const code = smsInfo?.status_code || payload?.status_code || "ERROR";
    throw new DeliveryProviderError(smsInfo?.status_text || payload?.status_text || "SMS.ru rejected message.", {
      code: `SMSRU_${code}`,
      retryable: ["300", "301", "302", "500"].includes(String(code)),
    });
  }
  return {
    provider: "smsru:sms",
    providerMessageId: String(smsInfo?.sms_id || `smsru-crm-agent-${message.outboxItemId}-${message.clientId}`),
    status: "SENT",
    raw: payload,
  };
}

async function sendTelegramProviderMessage(message) {
  if (message.channel !== "TELEGRAM") {
    throw new DeliveryProviderError("Telegram provider supports TELEGRAM channel only.", { code: "UNSUPPORTED_CHANNEL", retryable: false });
  }
  if (!DELIVERY_TELEGRAM_BOT_TOKEN) {
    throw new DeliveryProviderError("CRM_DELIVERY_TELEGRAM_BOT_TOKEN is not configured.", { code: "PROVIDER_NOT_CONFIGURED", retryable: false });
  }
  if (!message.target || !/^-?\d+$/.test(String(message.target))) {
    throw new DeliveryProviderError("Telegram chat id is missing for client.", { code: "NO_TARGET", retryable: false });
  }
  const response = await fetch(`${DELIVERY_TELEGRAM_API_URL}/bot${DELIVERY_TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: message.target,
      text: message.body,
      disable_web_page_preview: true,
    }),
  }).catch((error) => {
    throw new DeliveryProviderError(error instanceof Error ? error.message : "Telegram request failed.", {
      code: "TELEGRAM_NETWORK_ERROR",
      retryable: true,
    });
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new DeliveryProviderError(payload?.description || `Telegram returned HTTP ${response.status}.`, {
      code: `TELEGRAM_${payload?.error_code || response.status}`,
      retryable: response.status === 429 || response.status >= 500,
      status: response.status,
    });
  }
  return {
    provider: "telegram:bot",
    providerMessageId: String(payload?.result?.message_id || `telegram-crm-agent-${message.outboxItemId}-${message.clientId}`),
    status: "SENT",
    raw: payload,
  };
}

async function sendHttpProviderMessage(message) {
  if (!DELIVERY_HTTP_URL) {
    throw new DeliveryProviderError("CRM_DELIVERY_HTTP_URL is not configured.", {
      code: "PROVIDER_NOT_CONFIGURED",
      retryable: false,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_HTTP_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(DELIVERY_HTTP_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(DELIVERY_HTTP_TOKEN ? { authorization: `Bearer ${DELIVERY_HTTP_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        source: "crm_agent",
        accountId: message.accountId,
        outboxItemId: message.outboxItemId,
        campaignId: message.campaignId ?? null,
        draftId: message.draftId ?? null,
        clientId: message.clientId,
        channel: message.channel,
        target: message.target,
        title: message.title,
        body: message.body,
        metadata: message.metadata ?? {},
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error?.name === "AbortError";
    throw new DeliveryProviderError(aborted ? "Delivery provider timed out." : "Delivery provider request failed.", {
      code: aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_NETWORK_ERROR",
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const messageText =
      (payload && typeof payload === "object" && typeof payload.message === "string" && payload.message) ||
      `Delivery provider returned HTTP ${response.status}.`;
    throw new DeliveryProviderError(messageText, {
      code: `HTTP_${response.status}`,
      status: response.status,
      retryable: isRetryableStatus(response.status),
    });
  }

  return {
    provider: providerForChannel(message.channel),
    providerMessageId:
      (payload && typeof payload === "object" && typeof payload.messageId === "string" && payload.messageId) ||
      (payload && typeof payload === "object" && typeof payload.id === "string" && payload.id) ||
      `http-crm-agent-${message.outboxItemId}-${message.clientId}`,
    status: normalizeProviderStatus(payload && typeof payload === "object" ? payload.status : null),
    raw: payload,
  };
}

async function sendDeliveryMessage(message) {
  if (DELIVERY_PROVIDER === "http") return sendHttpProviderMessage(message);
  if (DELIVERY_PROVIDER === "smtp") return sendSmtpProviderMessage(message);
  if (DELIVERY_PROVIDER === "smsru") return sendSmsRuProviderMessage(message);
  if (DELIVERY_PROVIDER === "telegram") return sendTelegramProviderMessage(message);
  if (DELIVERY_PROVIDER === "auto") {
    if (message.channel === "EMAIL" && DELIVERY_SMTP_HOST) return sendSmtpProviderMessage(message);
    if (message.channel === "SMS" && DELIVERY_SMSRU_API_ID) return sendSmsRuProviderMessage(message);
    if (message.channel === "TELEGRAM" && DELIVERY_TELEGRAM_BOT_TOKEN) return sendTelegramProviderMessage(message);
  }
  return {
    provider: providerForChannel(message.channel),
    providerMessageId: `local-crm-agent-${message.outboxItemId}-${message.clientId}`,
    status: "SENT",
    raw: null,
  };
}

function deliverySuccessResult(result) {
  return {
    status: result.status === "DELIVERED" ? "DELIVERED" : "SENT",
    providerMessageId: result.providerMessageId,
    errorCode: null,
    errorMessage: null,
    sentAt: new Date(),
  };
}

function targetForChannel(channel, client) {
  if (channel === "EMAIL") return client.email || "";
  if (channel === "SMS") return client.phone || "";
  if (channel === "TELEGRAM") {
    const contact = Array.isArray(client.contacts)
      ? client.contacts.find((item) => ["telegram_chat_id", "telegram", "tg"].includes(String(item.type || "").toLowerCase()) && item.value)
      : null;
    return contact?.value || "";
  }
  if (channel === "SMS" || channel === "TELEGRAM" || channel === "MAX") return client.phone || client.email || "";
  if (client.userId) return `user:${client.userId}`;
  return client.phone || client.email || `client:${client.id}`;
}

function canDeliverToClient(channel, client) {
  if (channel === "EMAIL") return Boolean(client.email);
  if (channel === "SMS") return Boolean(client.phone);
  if (channel === "TELEGRAM") return Boolean(targetForChannel(channel, client));
  if (channel === "MAX") return Boolean(client.phone || client.email);
  return Boolean(client.userId || client.phone || client.email);
}

async function markOutboxFailed(outboxItem, message) {
  const payload = jsonObject(outboxItem.payload);
  const campaignId = typeof payload?.campaignId === "number" ? payload.campaignId : null;
  const draftId = typeof payload?.draftId === "number" ? payload.draftId : null;

  await prisma.$transaction([
    prisma.outboxItem.update({
      where: { id: outboxItem.id },
      data: { status: "FAILED", processedAt: new Date() },
    }),
    ...(campaignId
      ? [
          prisma.aiAgentCampaign.updateMany({
            where: { id: campaignId, accountId: outboxItem.accountId ?? undefined },
            data: { status: "FAILED", error: message },
          }),
        ]
      : []),
    ...(draftId
      ? [
          prisma.aiAgentNotificationDraft.updateMany({
            where: { id: draftId, accountId: outboxItem.accountId ?? undefined },
            data: { status: "FAILED", error: message },
          }),
        ]
      : []),
  ]);
}

async function markOutboxRetry(outboxItem, error, attempt) {
  const retryAt = nextRetryDate(attempt);
  await prisma.outboxItem.update({
    where: { id: outboxItem.id },
    data: {
      status: "PENDING",
      availableAt: retryAt,
      processedAt: null,
    },
  });
  return { id: outboxItem.id, status: "PENDING", retryAt: retryAt.toISOString(), error: error.message };
}

async function processDirectCrmAgentNotification(outboxItem, payload) {
  const accountId = outboxItem.accountId;
  const clientId = typeof payload.clientId === "number" ? payload.clientId : null;
  const draftId = typeof payload.draftId === "number" ? payload.draftId : null;
  if (!accountId || !clientId) throw new Error("У уведомления нет аккаунта или клиента.");

  const channel = String(payload.channel || "IN_APP").toUpperCase();
  const client = await prisma.client.findFirst({
    where: { id: clientId, accountId },
    select: { id: true, userId: true, firstName: true, lastName: true, phone: true, email: true, contacts: { select: { type: true, value: true } } },
  });
  if (!client) throw new Error("Клиент для уведомления не найден.");
  if (!canDeliverToClient(channel, client)) throw new Error("У клиента нет адреса доставки для выбранного канала.");

  const body = renderTemplate(payload.bodyText, client);
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Сообщение";
  const target = targetForChannel(channel, client);
  const attempt = (await prisma.deliveryLog.count({ where: { outboxItemId: outboxItem.id } })) + 1;

  const notificationData = {
    source: "crm_agent",
    outboxItemId: outboxItem.id,
    channel,
    clientId,
  };
  let providerResult;
  try {
    providerResult = await sendDeliveryMessage({
      accountId,
      outboxItemId: outboxItem.id,
      clientId: client.id,
      channel,
      target,
      title,
      body,
      metadata: { direct: true, consentType: payload.consentType ?? null },
    });
  } catch (error) {
    const providerError =
      error instanceof DeliveryProviderError
        ? error
        : new DeliveryProviderError(error instanceof Error ? error.message : "Delivery provider failed.", { retryable: true });
    await prisma.deliveryLog.create({
      data: {
        outboxItemId: outboxItem.id,
        channel,
        target,
        status: attempt >= DELIVERY_MAX_ATTEMPTS || !providerError.retryable ? "FAILED" : "QUEUED",
        attempt,
        errorCode: providerError.code,
        errorMessage: providerError.message,
      },
    });
    throw providerError;
  }

  await prisma.$transaction([
    ...(client.userId
      ? [
          prisma.notification.create({
            data: {
              userId: client.userId,
              accountId,
              title,
              body,
              data: notificationData,
            },
          }),
        ]
      : []),
    prisma.deliveryLog.create({
      data: {
        outboxItemId: outboxItem.id,
        channel,
        target,
        attempt,
        ...deliverySuccessResult(providerResult),
      },
    }),
    ...(draftId
      ? [
          prisma.aiAgentNotificationDraft.updateMany({
            where: { id: draftId, accountId },
            data: {
              status: "APPLIED",
              result: {
                sent: 1,
                delivered: providerResult.status === "DELIVERED" ? 1 : 0,
                failed: 0,
                skipped: 0,
                clientIds: [client.id],
                sentClientIds: [client.id],
                deliveredClientIds: providerResult.status === "DELIVERED" ? [client.id] : [],
                provider: providerResult.provider,
                processedAt: new Date().toISOString(),
              },
              error: null,
            },
          }),
        ]
      : []),
    prisma.outboxItem.update({
      where: { id: outboxItem.id },
      data: { status: "DONE", processedAt: new Date() },
    }),
  ]);

  return {
    sent: 1,
    delivered: providerResult.status === "DELIVERED" ? 1 : 0,
    failed: 0,
    skipped: 0,
    clientIds: [client.id],
    sentClientIds: [client.id],
    deliveredClientIds: providerResult.status === "DELIVERED" ? [client.id] : [],
    provider: providerResult.provider,
  };
}

async function processCrmAgentCampaignNotification(outboxItem, payload) {
  const accountId = outboxItem.accountId;
  const campaignId = typeof payload.campaignId === "number" ? payload.campaignId : null;
  const draftId = typeof payload.draftId === "number" ? payload.draftId : null;
  if (!accountId || !campaignId || !draftId) throw new Error("У кампании нет аккаунта, кампании или черновика.");

  const channel = String(payload.channel || "IN_APP").toUpperCase();
  const audience = jsonObject(payload.audience);
  const clientIds = numberArray(audience?.clientIds);
  const skippedByConsent = numberArray(audience?.skippedClientIds);
  if (!clientIds.length) throw new Error("В кампании нет получателей после проверки согласий.");

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, accountId },
    select: { id: true, userId: true, firstName: true, lastName: true, phone: true, email: true, contacts: { select: { type: true, value: true } } },
  });
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const deliveryWrites = [];
  const notificationWrites = [];
  const sentClientIds = [];
  const deliveredClientIds = [];
  const failedClientIds = [];
  const providerErrors = [];
  const attempt = (await prisma.deliveryLog.count({ where: { outboxItemId: outboxItem.id } })) + 1;

  for (const clientId of clientIds) {
    const client = clientsById.get(clientId);
    if (!client || !canDeliverToClient(channel, client)) {
      failedClientIds.push(clientId);
      deliveryWrites.push(
        prisma.deliveryLog.create({
          data: {
            outboxItemId: outboxItem.id,
            channel,
            target: client ? targetForChannel(channel, client) : `client:${clientId}`,
            status: "FAILED",
            attempt,
            errorCode: "NO_TARGET",
            errorMessage: "Нет адреса доставки для выбранного канала.",
          },
        }),
      );
      continue;
    }

    const body = renderTemplate(payload.bodyText, client);
    const target = targetForChannel(channel, client);
    const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Сообщение";
    let providerResult;
    try {
      providerResult = await sendDeliveryMessage({
        accountId,
        outboxItemId: outboxItem.id,
        campaignId,
        draftId,
        clientId: client.id,
        channel,
        target,
        title,
        body,
        metadata: { campaign: true, consentType: payload.consentType ?? null },
      });
    } catch (error) {
      const providerError =
        error instanceof DeliveryProviderError
          ? error
          : new DeliveryProviderError(error instanceof Error ? error.message : "Delivery provider failed.", { retryable: true });
      providerErrors.push(providerError);
      failedClientIds.push(client.id);
      deliveryWrites.push(
        prisma.deliveryLog.create({
          data: {
            outboxItemId: outboxItem.id,
            channel,
            target,
            status: attempt >= DELIVERY_MAX_ATTEMPTS || !providerError.retryable ? "FAILED" : "QUEUED",
            attempt,
            errorCode: providerError.code,
            errorMessage: providerError.message,
          },
        }),
      );
      continue;
    }
    if (client.userId) {
      notificationWrites.push(
        prisma.notification.create({
          data: {
            userId: client.userId,
            accountId,
            title,
            body,
            data: {
              source: "crm_agent_campaign",
              outboxItemId: outboxItem.id,
              campaignId,
              draftId,
              channel,
              clientId: client.id,
            },
          },
        }),
      );
    }
    deliveryWrites.push(
      prisma.deliveryLog.create({
        data: {
          outboxItemId: outboxItem.id,
          channel,
          target,
          attempt,
          ...deliverySuccessResult(providerResult),
        },
      }),
    );
    sentClientIds.push(client.id);
    if (providerResult.status === "DELIVERED") deliveredClientIds.push(client.id);
  }

  const retryableProviderFailure =
    sentClientIds.length === 0 && providerErrors.length > 0 && providerErrors.every((error) => error.retryable) && attempt < DELIVERY_MAX_ATTEMPTS;
  if (retryableProviderFailure) {
    await prisma.$transaction(deliveryWrites);
    throw providerErrors[0];
  }

  const result = {
    sent: sentClientIds.length,
    delivered: deliveredClientIds.length,
    failed: failedClientIds.length,
    skipped: skippedByConsent.length,
    sentClientIds,
    deliveredClientIds,
    failedClientIds,
    skippedClientIds: skippedByConsent,
    provider: providerForChannel(channel),
    processedAt: new Date().toISOString(),
  };

  await prisma.$transaction([
    ...notificationWrites,
    ...deliveryWrites,
    prisma.aiAgentCampaign.updateMany({
      where: { id: campaignId, accountId },
      data: {
        status: sentClientIds.length ? "SENT" : "FAILED",
        result,
        error: sentClientIds.length ? null : "Не удалось доставить кампанию ни одному получателю.",
        sentAt: sentClientIds.length ? new Date() : null,
      },
    }),
    prisma.aiAgentNotificationDraft.updateMany({
      where: { id: draftId, accountId },
      data: {
        status: sentClientIds.length ? "APPLIED" : "FAILED",
        result,
        error: sentClientIds.length ? null : "Не удалось доставить кампанию ни одному получателю.",
      },
    }),
    prisma.outboxItem.update({
      where: { id: outboxItem.id },
      data: { status: sentClientIds.length ? "DONE" : "FAILED", processedAt: new Date() },
    }),
  ]);

  return result;
}

async function processCrmAgentOutboxItem(outboxItem) {
  const claimed = await prisma.outboxItem.updateMany({
    where: { id: outboxItem.id, status: "PENDING" },
    data: { status: "PROCESSING" },
  });
  if (!claimed.count) return null;

  try {
    const payload = jsonObject(outboxItem.payload);
    if (!payload) throw new Error("Outbox payload must be an object.");

    let result;
    if (outboxItem.eventName === "crm_agent.notification.send") {
      result = await processDirectCrmAgentNotification(outboxItem, payload);
    } else if (outboxItem.eventName === "crm_agent.notification.campaign.send") {
      result = await processCrmAgentCampaignNotification(outboxItem, payload);
    } else {
      throw new Error(`Unsupported CRM agent outbox event: ${outboxItem.eventName}`);
    }

    return { id: outboxItem.id, status: "DONE", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка обработки уведомления.";
    const attempt = await prisma.deliveryLog.count({ where: { outboxItemId: outboxItem.id } });
    if (error instanceof DeliveryProviderError && error.retryable && attempt > 0 && attempt < DELIVERY_MAX_ATTEMPTS) {
      return markOutboxRetry(outboxItem, error, attempt);
    }
    await markOutboxFailed(outboxItem, message);
    return { id: outboxItem.id, status: "FAILED", error: message };
  }
}

async function processCrmAgentOutbox() {
  const outboxItems = await prisma.outboxItem.findMany({
    where: {
      eventName: { in: Array.from(CRM_AGENT_NOTIFICATION_EVENTS) },
      status: "PENDING",
      availableAt: { lte: new Date() },
    },
    orderBy: { id: "asc" },
    take: 50,
  });

  const results = [];
  for (const outboxItem of outboxItems) {
    const result = await processCrmAgentOutboxItem(outboxItem);
    if (result) results.push(result);
  }

  return {
    checked: outboxItems.length,
    done: results.filter((item) => item.status === "DONE").length,
    pendingRetry: results.filter((item) => item.status === "PENDING").length,
    failed: results.filter((item) => item.status === "FAILED").length,
  };
}

async function syncCrmAgentCampaignConversions() {
  const campaigns = await prisma.aiAgentCampaign.findMany({
    where: {
      status: { in: ["SENT", "SCHEDULED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      accountId: true,
      result: true,
      sentAt: true,
      createdAt: true,
    },
  });

  let campaignsChecked = 0;
  let conversionsLinked = 0;
  for (const campaign of campaigns) {
    const result = jsonObject(campaign.result);
    const sentClientIds = numberArray(result?.sentClientIds);
    if (!sentClientIds.length) continue;

    campaignsChecked += 1;
    const attributionStart = campaign.sentAt ?? campaign.createdAt;
    const attributionEnd = new Date(attributionStart);
    attributionEnd.setDate(attributionEnd.getDate() + 30);

    const appointments = await prisma.appointment.findMany({
      where: {
        accountId: campaign.accountId,
        clientId: { in: sentClientIds },
        createdAt: { gte: attributionStart, lte: attributionEnd },
        status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS", "DONE"] },
      },
      select: {
        id: true,
        clientId: true,
        priceTotal: true,
        createdAt: true,
      },
      take: 1000,
      orderBy: { createdAt: "asc" },
    });

    for (const appointment of appointments) {
      const created = await prisma.aiAgentCampaignConversion.upsert({
        where: {
          campaignId_appointmentId: {
            campaignId: campaign.id,
            appointmentId: appointment.id,
          },
        },
        create: {
          accountId: campaign.accountId,
          campaignId: campaign.id,
          clientId: appointment.clientId,
          appointmentId: appointment.id,
          revenue: appointment.priceTotal,
          occurredAt: appointment.createdAt,
        },
        update: {
          revenue: appointment.priceTotal,
          occurredAt: appointment.createdAt,
        },
        select: { id: true, createdAt: true },
      });
      if (created.createdAt.getTime() >= Date.now() - 60 * 1000) conversionsLinked += 1;
    }

    const conversions = await prisma.aiAgentCampaignConversion.findMany({
      where: { accountId: campaign.accountId, campaignId: campaign.id },
      select: { clientId: true, appointmentId: true, revenue: true },
    });
    const convertedClientIds = Array.from(new Set(conversions.map((conversion) => conversion.clientId)));
    const mergedResult = {
      ...(result ?? {}),
      conversion: {
        attributionWindowDays: 30,
        appointments: conversions.length,
        convertedClients: convertedClientIds.length,
        conversionRate: sentClientIds.length ? convertedClientIds.length / sentClientIds.length : 0,
        revenue: moneySum(conversions.map((conversion) => conversion.revenue)),
        appointmentIds: conversions.map((conversion) => conversion.appointmentId).slice(0, 200),
        convertedClientIds: convertedClientIds.slice(0, 200),
        updatedAt: new Date().toISOString(),
      },
    };

    await prisma.aiAgentCampaign.updateMany({
      where: { id: campaign.id, accountId: campaign.accountId },
      data: { result: mergedResult },
    });
  }

  return { campaignsChecked, conversionsLinked };
}

async function createInsightIfMissing(input) {
  const key = insightKey(input.type, input.scope);
  const existing = await prisma.aiAccountInsight.findFirst({
    where: {
      accountId: input.accountId,
      type: input.type,
      status: "NEW",
      data: { path: ["key"], equals: key },
    },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.aiAccountInsight.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      title: input.title,
      summary: input.summary,
      priority: input.priority,
      data: { ...input.data, key },
    },
  });
}

async function generateAccountInsights(accountId) {
  const now = new Date();
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyToThirtyDaysAgo = new Date(now);
  sixtyToThirtyDaysAgo.setDate(now.getDate() - 60);
  const nextSevenDays = new Date(now);
  nextSevenDays.setDate(now.getDate() + 7);

  const [
    memoryHints,
    activePromos,
    negativeReviews,
    recentNegativeReviewRows,
    retentionClients,
    recentAppointments,
    previousAppointments,
    upcomingSchedule,
    upcomingBusyAppointments,
    activeSpecialists,
  ] = await Promise.all([
    buildMemoryHints(accountId),
    prisma.promotion.count({ where: { accountId, isActive: true } }),
    prisma.review.count({ where: { accountId, rating: { lte: 3 }, createdAt: { gte: sevenDaysAgo } } }),
    prisma.review.findMany({
      where: { accountId, rating: { lte: 3 }, status: "PUBLISHED", createdAt: { gte: thirtyDaysAgo }, comment: { not: null } },
      select: { id: true, rating: true, comment: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.client.count({
      where: {
        accountId,
        appointments: {
          some: { startAt: { lt: sixtyDaysAgo }, status: "DONE" },
          none: { startAt: { gte: sixtyDaysAgo }, status: { not: "CANCELLED" } },
        },
      },
    }),
    prisma.appointment.findMany({
      where: { accountId, startAt: { gte: thirtyDaysAgo, lte: now } },
      select: {
        id: true,
        startAt: true,
        specialistId: true,
        status: true,
        priceTotal: true,
        durationTotalMin: true,
        services: { select: { serviceId: true, service: { select: { name: true } } } },
      },
    }),
    prisma.appointment.findMany({
      where: { accountId, startAt: { gte: sixtyToThirtyDaysAgo, lt: thirtyDaysAgo }, status: { in: BUSY_STATUSES } },
      select: { id: true, services: { select: { serviceId: true, service: { select: { name: true } } } } },
    }),
    prisma.scheduleEntry.findMany({
      where: { accountId, date: { gte: startOfDay(now), lte: endOfDay(nextSevenDays) }, type: "WORKING" },
      select: { id: true, date: true, specialistId: true, locationId: true, startTime: true, endTime: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 400,
    }),
    prisma.appointment.findMany({
      where: {
        accountId,
        startAt: { gte: startOfDay(now), lte: endOfDay(nextSevenDays) },
        status: { in: BUSY_STATUSES },
      },
      select: { id: true, startAt: true, endAt: true, specialistId: true, locationId: true, status: true },
      orderBy: { startAt: "asc" },
      take: 1000,
    }),
    prisma.specialistProfile.findMany({
      where: { accountId, isPublic: true },
      select: { id: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
      take: 300,
    }),
  ]);

  const created = [];
  const memorySuffix = memoryHints.recommendationSuffix ? ` ${memoryHints.recommendationSuffix}` : "";
  if (activePromos === 0) {
    const insight = await createInsightIfMissing({
      accountId,
      type: "promo.missing",
      scope: "active",
      title: "Нет активных акций",
      summary: `Сейчас нет ни одной активной акции. Можно подготовить точечное предложение под слабые дни или свободные окна.${memorySuffix}`,
      priority: 50,
      data: { activePromos, memoryHints },
    });
    if (insight) created.push(insight);
  }

  if (negativeReviews > 0) {
    const insight = await createInsightIfMissing({
      accountId,
      type: "reviews.negative_recent",
      scope: "last_7_days",
      title: "Есть свежие негативные отзывы",
      summary: `За последние 7 дней появилось негативных отзывов: ${negativeReviews}.`,
      priority: 80,
      data: { negativeReviews, days: 7 },
    });
    if (insight) created.push(insight);
  }

  const complaintThemes = recurringComplaintThemes(recentNegativeReviewRows);
  if (complaintThemes.length) {
    const topTheme = complaintThemes[0];
    const insight = await createInsightIfMissing({
      accountId,
      type: "reviews.recurring_complaints",
      scope: "last_30_days",
      title: "Повторяются причины недовольства в отзывах",
      summary: `В негативных отзывах за 30 дней чаще всего повторяется тема «${topTheme.label}» (${topTheme.count} раза). Стоит проверить процесс и подготовить ответы клиентам.`,
      priority: 82,
      data: { days: 30, themes: complaintThemes },
    });
    if (insight) created.push(insight);
  }

  if (retentionClients > 0) {
    const insight = await createInsightIfMissing({
      accountId,
      type: "clients.retention_opportunity",
      scope: "60_days",
      title: "Есть клиенты для возврата",
      summary: `${retentionClients} клиентов не были на визите больше 60 дней.${memorySuffix}`,
      priority: 70,
      data: { retentionClients, days: 60, memoryHints },
    });
    if (insight) created.push(insight);
  }

  const recentByDay = new Map();
  const recentBySpecialist = new Map();
  let lostAppointments = 0;
  let noShowAppointments = 0;

  for (const appointment of recentAppointments) {
    const key = dateKey(appointment.startAt);
    const byDay = recentByDay.get(key) ?? { appointments: 0, revenue: 0 };
    byDay.appointments += 1;
    byDay.revenue += Number(appointment.priceTotal);
    recentByDay.set(key, byDay);

    const bySpecialist = recentBySpecialist.get(appointment.specialistId) ?? { appointments: 0, revenue: 0, durationMin: 0 };
    if (BUSY_STATUSES.includes(appointment.status)) {
      bySpecialist.appointments += 1;
      bySpecialist.revenue += Number(appointment.priceTotal);
      bySpecialist.durationMin += appointment.durationTotalMin;
    }
    recentBySpecialist.set(appointment.specialistId, bySpecialist);

    if (LOST_STATUSES.includes(appointment.status)) lostAppointments += 1;
    if (appointment.status === "NO_SHOW") noShowAppointments += 1;
  }

  const previousByService = new Map();
  for (const appointment of previousAppointments) {
    for (const item of appointment.services) {
      const current = previousByService.get(item.serviceId) ?? { serviceId: item.serviceId, name: item.service.name, appointments: 0 };
      current.appointments += 1;
      previousByService.set(item.serviceId, current);
    }
  }
  const recentByService = new Map();
  for (const appointment of recentAppointments) {
    if (!BUSY_STATUSES.includes(appointment.status)) continue;
    for (const item of appointment.services) {
      const current = recentByService.get(item.serviceId) ?? { serviceId: item.serviceId, name: item.service.name, appointments: 0 };
      current.appointments += 1;
      recentByService.set(item.serviceId, current);
    }
  }
  const decliningServices = Array.from(previousByService.values())
    .map((previous) => {
      const recent = recentByService.get(previous.serviceId)?.appointments ?? 0;
      const declineRate = previous.appointments ? (previous.appointments - recent) / previous.appointments : 0;
      return { ...previous, previousAppointments: previous.appointments, recentAppointments: recent, declineRate };
    })
    .filter((service) => service.previousAppointments >= 3 && service.declineRate >= 0.5)
    .sort((a, b) => b.declineRate - a.declineRate)
    .slice(0, 5);
  if (decliningServices.length) {
    const insight = await createInsightIfMissing({
      accountId,
      type: "services.declining",
      scope: "last_30_vs_previous_30",
      title: "Есть услуги с просевшим спросом",
      summary: `${decliningServices.length} услуг заметно просели по записям за последние 30 дней по сравнению с предыдущими 30 днями. Можно проверить цены, описание и подготовить точечное предложение.`,
      priority: 64,
      data: { decliningServices },
    });
    if (insight) created.push(insight);
  }

  const dayRows = Array.from(recentByDay.entries()).map(([day, value]) => ({ day, ...value }));
  const averageAppointmentsPerActiveDay = dayRows.length
    ? dayRows.reduce((sum, row) => sum + row.appointments, 0) / dayRows.length
    : 0;
  const weakDays = dayRows
    .filter((row) => averageAppointmentsPerActiveDay >= 3 && row.appointments <= Math.max(1, Math.floor(averageAppointmentsPerActiveDay * 0.45)))
    .sort((a, b) => a.appointments - b.appointments)
    .slice(0, 3);

  if (weakDays.length) {
    const insight = await createInsightIfMissing({
      accountId,
      type: "schedule.weak_days",
      scope: "last_30_days",
      title: "Найдены слабые дни по записям",
      summary: `${weakDays.length} дней за последние 30 дней заметно ниже среднего.`,
      priority: 62,
      data: { weakDays: weakDays.map((day) => ({ ...day, weekday: dayName(day.day) })), averageAppointmentsPerActiveDay },
    });
    if (insight) created.push(insight);
  }

  const activeSpecialistIds = new Set(activeSpecialists.map((specialist) => specialist.id));
  const underloadedSpecialists = Array.from(activeSpecialistIds)
    .map((specialistId) => {
      const stats = recentBySpecialist.get(specialistId) ?? { appointments: 0, revenue: 0, durationMin: 0 };
      const specialist = activeSpecialists.find((item) => item.id === specialistId);
      const profile = specialist?.user.profile;
      return {
        specialistId,
        name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || `Сотрудник #${specialistId}`,
        ...stats,
      };
    })
    .filter((item) => activeSpecialists.length >= 2 && item.appointments <= 2)
    .sort((a, b) => a.appointments - b.appointments)
    .slice(0, 5);

  if (underloadedSpecialists.length) {
    const insight = await createInsightIfMissing({
      accountId,
      type: "specialists.underloaded",
      scope: "last_30_days",
      title: "Есть недозагруженные сотрудники",
      summary: `${underloadedSpecialists.length} публичных сотрудников получили очень мало записей за последние 30 дней.`,
      priority: 58,
      data: { underloadedSpecialists },
    });
    if (insight) created.push(insight);
  }

  const lostRate = recentAppointments.length ? lostAppointments / recentAppointments.length : 0;
  if (recentAppointments.length >= 10 && lostRate >= 0.18) {
    const insight = await createInsightIfMissing({
      accountId,
      type: "appointments.loss_rate_high",
      scope: "last_30_days",
      title: "Много отмен и неявок",
      summary: `${percent(lostRate)}% записей за последние 30 дней отменены или отмечены как неявка.`,
      priority: noShowAppointments > 0 ? 76 : 66,
      data: { totalAppointments: recentAppointments.length, lostAppointments, noShowAppointments, lostRate },
    });
    if (insight) created.push(insight);
  }

  const emptyWindows = [];
  for (const entry of upcomingSchedule) {
    const startMin = minutesFromTime(entry.startTime);
    const endMin = minutesFromTime(entry.endTime);
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    const bookedMinutes = upcomingBusyAppointments
      .filter((appointment) => appointment.specialistId === entry.specialistId && dateKey(appointment.startAt) === dateKey(entry.date))
      .reduce((sum, appointment) => {
        const start = Math.max(startMin, appointment.startAt.getHours() * 60 + appointment.startAt.getMinutes());
        const end = Math.min(endMin, appointment.endAt.getHours() * 60 + appointment.endAt.getMinutes());
        return sum + Math.max(0, end - start);
      }, 0);
    const freeMinutes = Math.max(0, endMin - startMin - bookedMinutes);
    if (freeMinutes >= 180) {
      emptyWindows.push({
        date: dateKey(entry.date),
        specialistId: entry.specialistId,
        locationId: entry.locationId,
        freeMinutes,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
    }
  }

  if (emptyWindows.length) {
    const insight = await createInsightIfMissing({
      accountId,
      type: "schedule.empty_windows",
      scope: "next_7_days",
      title: "В графике есть большие свободные окна",
      summary: `На ближайшие 7 дней найдено свободных окон от 3 часов: ${emptyWindows.length}.`,
      priority: 72,
      data: { emptyWindows: emptyWindows.slice(0, 10) },
    });
    if (insight) created.push(insight);
  }

  return created.length;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function createDailyBriefTask(accountId, createdInsights) {
  const date = todayKey();
  const type = `daily_brief:${date}`;
  const existing = await prisma.aiAgentTask.findFirst({
    where: { accountId, type, status: { in: ["OPEN", "IN_PROGRESS", "DONE"] } },
    select: { id: true },
  });
  if (existing) return null;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [pendingActions, newInsights, appointmentsTodayAndTomorrow, negativeReviews] = await Promise.all([
    prisma.aiPendingAction.count({ where: { accountId, status: "PENDING", expiresAt: { gt: now } } }),
    prisma.aiAccountInsight.count({ where: { accountId, status: "NEW" } }),
    prisma.appointment.count({
      where: {
        accountId,
        startAt: { gte: startOfDay(now), lte: endOfDay(tomorrow) },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.review.count({ where: { accountId, rating: { lte: 3 }, createdAt: { gte: sevenDaysAgo } } }),
  ]);

  return prisma.aiAgentTask.create({
    data: {
      accountId,
      type,
      title: `Ежедневная сводка ассистента за ${date}`,
      description: `Записи сегодня и завтра: ${appointmentsTodayAndTomorrow}. Новые рекомендации: ${newInsights}. Действия на подтверждение: ${pendingActions}. Негативные отзывы за 7 дней: ${negativeReviews}.`,
      payload: {
        date,
        createdInsights,
        pendingActions,
        newInsights,
        appointmentsTodayAndTomorrow,
        negativeReviews,
      },
    },
  });
}

async function runCrmAgentBackgroundPass() {
  const outbox = await processCrmAgentOutbox();
  const conversions = await syncCrmAgentCampaignConversions();

  const expired = await prisma.aiPendingAction.updateMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });

  const accounts = await prisma.account.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    take: 500,
  });

  let createdInsights = 0;
  let createdBriefs = 0;
  for (const account of accounts) {
    const accountCreatedInsights = await generateAccountInsights(account.id);
    createdInsights += accountCreatedInsights;
    const brief = await createDailyBriefTask(account.id, accountCreatedInsights);
    if (brief) createdBriefs += 1;
  }

  return { outbox, conversions, expiredPendingActions: expired.count, accountsChecked: accounts.length, createdInsights, createdBriefs };
}

runCrmAgentBackgroundPass()
  .then((result) => {
    console.log(JSON.stringify({ worker: "crm-agent", result }));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
