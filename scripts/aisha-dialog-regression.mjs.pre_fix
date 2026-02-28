#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.AISHA_BASE_URL || "http://localhost:3000";
const ACCOUNT_FROM_ENV = process.env.AISHA_ACCOUNT || "";
const TIMEOUT_MS = Number(process.env.AISHA_TIMEOUT_MS || 15000);
const SUITE = (process.env.AISHA_SUITE || process.argv.find((a) => a.startsWith("--suite="))?.split("=")[1] || "all").trim();
let ACCOUNT = ACCOUNT_FROM_ENV || "beauty-salon";

/**
 * @typedef {"core" | "booking-e2e" | "client-actions"} ScenarioSuite
 */

/**
 * @typedef {{
 *   send?: string;
 *   pick?: "location" | "time" | "service" | "specialist" | "consent" | "confirm" | "mode_self" | "mode_assistant";
 *   fallbackSend?: string;
 *   ifReply?: RegExp;
 *   unlessReply?: RegExp;
 *   expectAny?: RegExp[];
 *   rejectAny?: RegExp[];
 * }} Step
 */

/**
 * @typedef {{
 *   name: string;
 *   suites: ScenarioSuite[];
 *   steps: Step[];
 * }} Scenario
 */

/**
 * @typedef {{
 *   suite: string;
 *   baseUrl: string;
 *   account: string;
 *   startedAt: string;
 *   finishedAt?: string;
 *   durationMs?: number;
 *   passed: boolean;
 *   scenarios: Array<{
 *     name: string;
 *     passed: boolean;
 *     steps: Array<{
 *       index: number;
 *       sent: string;
 *       skipped?: boolean;
 *       reason?: string;
 *       passed?: boolean;
 *       error?: string;
 *       reply?: string;
 *     }>;
 *   }>;
 * }} RunReport
 */

const scenarios = /** @type {Scenario[]} */ ([
  { name: "Greeting basic", suites: ["core"], steps: [{ send: "привет", expectAny: [/здравств|привет|чем помочь/i] }] },
  { name: "Abuse de-escalation", suites: ["core"], steps: [{ send: "привет сучка", expectAny: [/уваж|давайте общаться|чем.*помочь|здравств/i] }] },
  { name: "Identity intent", suites: ["core"], steps: [{ send: "кто ты", expectAny: [/аиша|ассистент|чем помочь|здравств/i] }] },
  { name: "Capabilities intent", suites: ["core"], steps: [{ send: "что умеешь", expectAny: [/запис|услуг|время|запис[ьи]/i] }] },
  {
    name: "Capabilities follow-up should route to DB services",
    suites: ["core"],
    steps: [
      { send: "а что ты можешь?", expectAny: [/запис|услуг|время|контакт|статистик/i] },
      { send: "а какие именно есть?", expectAny: [/Balayage|Men Haircut|Women Haircut|Manicure|Pedicure|Gel Polish/i], rejectAny: [/spa|свадебн|макияж|укладк/i] },
    ],
  },
  { name: "Current datetime intent", suites: ["core"], steps: [{ send: "какое сейчас число и время?", expectAny: [/\d{2}\.\d{2}\.\d{4}|\d{2}:\d{2}/i] }] },
  { name: "Contact phone intent", suites: ["core"], steps: [{ send: "дай номер", expectAny: [/номер|телефон|недоступ/i] }] },
  { name: "Working hours intent", suites: ["core"], steps: [{ send: "до скольки работаете?", expectAny: [/работ|график|09:00|21:00|часы/i] }] },
  { name: "Address intent", suites: ["core"], steps: [{ send: "где находитесь?", expectAny: [/локац|адрес|филиал|tverskaya|kutuzovsky/i] }] },
  { name: "Services list intent", suites: ["core"], steps: [{ send: "какие услуги есть?", expectAny: [/услуг|manicure|haircut|pedicure|gel/i] }] },
  { name: "Services for men intent", suites: ["core"], steps: [{ send: "мужские услуги есть?", expectAny: [/муж|услуг|men haircut|выберите/i] }] },
  { name: "Specific price intent grounded", suites: ["core"], steps: [{ send: "сколько стоит peeling", expectAny: [/peeling|₽|мин/i], rejectAny: [/от 500|от 700/i] }] },
  { name: "General price intent grounded", suites: ["core"], steps: [{ send: "по стоимости сориентируй", expectAny: [/₽|стоим|услуг/i], rejectAny: [/от 500|от 700/i] }] },
  { name: "Specialists generic", suites: ["core"], steps: [{ send: "какие мастера есть?", expectAny: [/специалист|мастер/i] }] },
  {
    name: "Who works tomorrow + location keeps specialist flow",
    suites: ["core"],
    steps: [
      { send: "кто завтра работает", expectAny: [/специалист|мастер/i], rejectAny: [/выберите услугу|доступные услуги/i] },
      { send: "Beauty Salon Riverside", expectAny: [/специалист|мастер|работают/i], rejectAny: [/выберите услугу|доступные услуги/i] },
    ],
  },
  {
    name: "Specialist name should not reset to greeting",
    suites: ["core"],
    steps: [
      { send: "кто завтра из мастеров работает?", expectAny: [/специалист|мастер/i] },
      { send: "Maria Petrova", rejectAny: [/я аиша|чем помочь|здравствуйте/i] },
    ],
  },
  { name: "Out-of-domain query should not crash", suites: ["core"], steps: [{ send: "расскажи анекдот про космос", expectAny: [/запис|услуг|помочь|уточн|домен|салон/i] }] },
  { name: "Unknown gibberish should not crash", suites: ["core"], steps: [{ send: "asdasd qwe zzz", expectAny: [/уточн|не понял|помочь|запис|услуг|интерес/i] }] },
  { name: "Post-thanks should remain polite", suites: ["core"], steps: [{ send: "спасибо", expectAny: [/пожалуйста|обращайт|помочь|запис/i] }] },

  {
    name: "Start booking asks for location, not unknown service",
    suites: ["booking-e2e"],
    steps: [{ send: "на завтра запиши меня", expectAny: [/филиал|локац|beauty salon center|beauty salon riverside/i], rejectAny: [/такой услуги не нашл|услугу .* не нашл/i] }],
  },
  { name: "Availability today", suites: ["booking-e2e"], steps: [{ send: "на сегодня есть свободные окна?", expectAny: [/окна|время|слот|филиал/i] }] },
  { name: "Availability evening", suites: ["booking-e2e"], steps: [{ send: "на вечер что есть?", expectAny: [/окна|время|слот|вечер|филиал/i] }] },
  {
    name: "Nearest availability should return windows immediately",
    suites: ["booking-e2e"],
    steps: [{ send: "а свободное окошко когда ближайшее?", expectAny: [/\d{2}:\d{2}/i, /окна|ближайшие|время|слот/i] }],
  },
  { name: "Availability in March", suites: ["booking-e2e"], steps: [{ send: "в марте есть время?", expectAny: [/дата|окна|время|могу проверить|ближайшие/i] }] },
  { name: "Booking service-first path", suites: ["booking-e2e"], steps: [{ send: "хочу на маникюр завтра", expectAny: [/филиал|время|слот|локац|услуга|стоим|мин/i] }] },
  {
    name: "Unknown service should be rejected with available options",
    suites: ["booking-e2e"],
    steps: [
      { send: "запиши на удаление зуба", expectAny: [/филиал|локац|beauty salon center|beauty salon riverside/i] },
      { send: "Beauty Salon Center" },
      { send: "удаление зуба", expectAny: [/не нашл|такой услуги .*нет|данной услуги .*нет|выберите услугу|доступные услуги|выберите.*доступн/i], rejectAny: [/проверьте данные|как завершим запись/i] },
    ],
  },
  {
    name: "E2E booking self mode",
    suites: ["booking-e2e"],
    steps: [
      { send: "запиши меня на завтра", expectAny: [/филиал|локац|beauty salon/i] },
      { pick: "location", expectAny: [/время|слот|окна|услуг|специалист|выберите/i] },
      { send: "покажи все свободное время", ifReply: /показать все|\(\+еще|\(\+ещё|время|окна|слоты/i },
      { pick: "time", expectAny: [/услуг|специалист|проверьте данные|выберите/i] },
      { pick: "service", ifReply: /услуг|выберите услугу/i, expectAny: [/специалист|проверьте данные|как завершим запись|выберите/i] },
      { pick: "specialist", ifReply: /выберите специалист|доступны специалисты/i, expectAny: [/проверьте данные|как завершим запись/i] },
      { pick: "mode_self", expectAny: [/открываю онлайн-запись|онлайн-запись/i] },
    ],
  },
  {
    name: "E2E booking assistant mode",
    suites: ["booking-e2e"],
    steps: [
      { send: "хочу записаться на завтра", expectAny: [/филиал|локац|beauty salon/i] },
      { pick: "location", expectAny: [/время|слот|окна|услуг|специалист|выберите/i] },
      { send: "покажи все свободное время", ifReply: /показать все|\(\+еще|\(\+ещё|время|окна|слоты/i },
      { pick: "time", expectAny: [/услуг|специалист|проверьте данные|выберите/i] },
      { pick: "service", ifReply: /услуг|выберите услугу/i, expectAny: [/специалист|проверьте данные|как завершим запись|выберите/i] },
      { pick: "specialist", ifReply: /выберите специалист|доступны специалисты/i, expectAny: [/проверьте данные|как завершим запись/i] },
      { pick: "mode_assistant", expectAny: [/согласие|персональн|имя и номер|проверьте данные/i] },
      { send: "Надежда +79001234567", ifReply: /имя и номер телефона|напишите имя и номер/i, expectAny: [/согласие|персональн|проверьте данные|запись оформлена/i] },
      { pick: "consent", ifReply: /согласие|персональн/i, expectAny: [/проверьте данные|клиент|нажмите кнопку «?записаться»?|напишите «?да»?/i] },
      { pick: "confirm", ifReply: /нажмите кнопку «?записаться»?|напишите «?да»?|если все верно/i, expectAny: [/запись оформлена|номер записи/i] },
    ],
  },
  {
    name: "Consent step must not reappear on unrelated smalltalk",
    suites: ["booking-e2e"],
    steps: [
      { send: "хочу записаться на завтра", expectAny: [/филиал|локац|beauty salon/i] },
      { pick: "location", expectAny: [/время|слот|окна|услуг|специалист|выберите/i] },
      { send: "покажи все свободное время", ifReply: /показать все|\(\+еще|\(\+ещё|время|окна|слоты/i },
      { pick: "time", expectAny: [/услуг|специалист|проверьте данные|выберите/i] },
      { pick: "service", ifReply: /услуг|выберите услугу/i, expectAny: [/специалист|проверьте данные|как завершим запись|выберите/i] },
      { pick: "specialist", ifReply: /выберите специалист|доступны специалисты/i, expectAny: [/проверьте данные|как завершим запись/i] },
      { pick: "mode_assistant", expectAny: [/согласие|персональн|имя и номер|проверьте данные/i] },
      { send: "Надежда +79001234567", ifReply: /имя и номер телефона|напишите имя и номер/i, expectAny: [/согласие|персональн|проверьте данные|запись оформлена/i] },
      { pick: "consent", ifReply: /согласие|персональн/i, expectAny: [/проверьте данные|клиент|нажмите кнопку «?записаться»?|напишите «?да»?/i] },
      { send: "привет", expectAny: [/здравств|чем помочь|привет/i], rejectAny: [/согласие|персональн|подтвердите галочкой/i] },
      { send: "какая у меня статистика?", expectAny: [/статист|авторизац|личн|визит|отмен/i] },
      { send: "это круто", expectAny: [/круто|отличн|рада|здорово|приятно|помощ|обращ/i], rejectAny: [/согласие|персональн|подтвердите галочкой/i] },
    ],
  },

  { name: "Client my bookings flow handles auth/result", suites: ["client-actions"], steps: [{ send: "какая у меня ближайшая запись", expectAny: [/запись|авторизац|личн/i] }] },
  { name: "Client past bookings flow handles auth/result", suites: ["client-actions"], steps: [{ send: "какая у меня прошедшая запись", expectAny: [/запись|авторизац|личн/i] }] },
  { name: "Client stats flow handles auth/result", suites: ["client-actions"], steps: [{ send: "моя статистика", expectAny: [/статист|авторизац|личн|визит|отмен/i] }] },
  { name: "Client cancel flow handles auth/result", suites: ["client-actions"], steps: [{ send: "отмени мою ближайшую запись", expectAny: [/отмен|подтверж|авторизац|личн|не нашл/i] }] },
  { name: "Client reschedule flow handles auth/result", suites: ["client-actions"], steps: [{ send: "перенеси мою запись на завтра в 18:00", expectAny: [/перен|подтверж|авторизац|личн|не нашл|слот/i] }] },
  { name: "Client profile flow handles auth/result", suites: ["client-actions"], steps: [{ send: "покажи мои данные", expectAny: [/профил|данн|авторизац|личн/i] }] },
]);

function activeScenarios() {
  if (SUITE === "all") return scenarios;
  return scenarios.filter((s) => s.suites.includes(/** @type {ScenarioSuite} */ (SUITE)));
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout: ${label} (${timeoutMs}ms)`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeUiOptions(rawUi) {
  if (!rawUi || typeof rawUi !== "object") return [];
  const kind = String(rawUi.kind || "");
  const options = Array.isArray(rawUi.options) ? rawUi.options : [];
  if (!options.length) return [];
  if (kind && kind !== "quick_replies" && kind !== "consent") return [];
  return options
    .map((opt) => ({
      label: String(opt?.label ?? "").trim(),
      value: String(opt?.value ?? "").trim(),
    }))
    .filter((opt) => opt.label || opt.value);
}
async function sendMessage({ message, threadId }) {
  const url = new URL("/api/v1/public/ai/chat", BASE_URL);
  url.searchParams.set("account", ACCOUNT);
  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, threadId }),
    }),
    TIMEOUT_MS,
    `POST ${url.pathname}`,
  );
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.data?.reply) {
    if (res.status === 404 && payload?.error?.code === "ACCOUNT_NOT_FOUND") {
      throw new Error(
        `Account not found for '${ACCOUNT}'. Run with AISHA_ACCOUNT=<slug>, e.g. AISHA_ACCOUNT=beauty-salon npm run test:aisha-dialogs`,
      );
    }
    throw new Error(`Bad response: HTTP ${res.status} ${JSON.stringify(payload)}`);
  }
  return {
    threadId: Number(payload.data.threadId),
    reply: String(payload.data.reply),
  };
}

async function accountExists(account) {
  const url = new URL("/api/v1/public/ai/chat", BASE_URL);
  url.searchParams.set("account", account);
  const res = await withTimeout(fetch(url, { method: "GET" }), TIMEOUT_MS, `GET ${url.pathname}`);
  if (res.ok) return true;
  const payload = await res.json().catch(() => null);
  return !(res.status === 404 && payload?.error?.code === "ACCOUNT_NOT_FOUND");
}

async function resolveAccount() {
  if (ACCOUNT_FROM_ENV) return ACCOUNT_FROM_ENV;
  const candidates = ["beauty-salon", "beauty-salon_3", "demo", "beauty-salon-3", "beauty"];
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await accountExists(candidate)) return candidate;
  }
  throw new Error("Could not auto-detect account slug. Run with AISHA_ACCOUNT=<slug>.");
}

function assertStep({ scenarioName, stepIndex, step, reply }) {
  const label = `${scenarioName} / step ${stepIndex + 1} (${step.send ?? `pick:${step.pick}`})`;
  if (step.expectAny?.length) {
    const ok = step.expectAny.some((re) => re.test(reply));
    if (!ok) {
      throw new Error(`${label}: expected one of ${step.expectAny.map(String).join(", ")}\nreply:\n${reply}`);
    }
  }
  if (step.rejectAny?.length) {
    const bad = step.rejectAny.find((re) => re.test(reply));
    if (bad) {
      throw new Error(`${label}: must not match ${String(bad)}\nreply:\n${reply}`);
    }
  }
}

function extractLocations(reply) {
  const matches = Array.from(reply.matchAll(/\b(Beauty Salon Center|Beauty Salon Riverside)\b/g)).map((m) => m[1]).filter(Boolean);
  return Array.from(new Set(matches));
}

function extractTimes(reply) {
  const matches = Array.from(reply.matchAll(/\b([01]\d|2[0-3]):([0-5]\d)\b/g)).map((m) => `${m[1]}:${m[2]}`);
  return Array.from(new Set(matches));
}

function extractServices(reply) {
  const rows = Array.from(reply.matchAll(/(?:^|\n)\s*(?:\d+\.\s+)?([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9\s\-]+?)\s+—\s+\d+/g))
    .map((m) => (m[1] ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(rows));
}

function extractSpecialists(reply) {
  const numbered = Array.from(reply.matchAll(/(?:^|\n)\s*\d+\.\s+([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s\-]{2,})/g))
    .map((m) => (m[1] ?? "").trim())
    .filter(Boolean);
  if (numbered.length) return Array.from(new Set(numbered));
  const bullets = Array.from(reply.matchAll(/(?:^|\n)\s*•\s*([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s\-]{2,})/g))
    .map((m) => (m[1] ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(bullets));
}

function pickFromUi(stepPick, uiOptions) {
  if (!Array.isArray(uiOptions) || !uiOptions.length) return null;
  const items = uiOptions.map((x) => ({ label: x.label || "", value: x.value || "" }));
  const by = (re) => items.find((x) => re.test(`${x.label} ${x.value}`));
  const isTime = (x) => /(?:^|\s)([01]\d|2[0-3]):([0-5]\d)(?:\s|$)/.test(`${x.label} ${x.value}`);
  const isLocation = (x) => /(beauty salon|riverside|center|филиал|локац)/i.test(`${x.label} ${x.value}`);
  const isMode = (x) => /(самостоятельно|через ассистента|assistant|self)/i.test(`${x.label} ${x.value}`);
  const isService = (x) =>
    /—\s*\d+/.test(x.label) ||
    /(haircut|facial|peeling|pedicure|manicure|balayage|coloring|стриж|маник|педик|пилинг|окраш)/i.test(
      `${x.label} ${x.value}`,
    );

  if (stepPick === "location") return (by(/(beauty salon|riverside|center|филиал|локац)/i) || items[0] || null)?.value || null;
  if (stepPick === "time") return (items.find(isTime) || null)?.value || null;
  if (stepPick === "service") return (items.find((x) => !isTime(x) && !isLocation(x) && isService(x)) || null)?.value || null;
  if (stepPick === "specialist")
    return (
      items.find((x) => !isTime(x) && !isLocation(x) && !isMode(x) && !isService(x) && /[A-Za-zА-Яа-яЁё]{2,}/.test(`${x.label} ${x.value}`)) ||
      null
    )?.value || null;
  if (stepPick === "mode_self") return (by(/самостоятельно|self/i) || null)?.value || null;
  if (stepPick === "mode_assistant") return (by(/через ассистента|assistant/i) || null)?.value || null;
  if (stepPick === "consent") return (by(/согласен|согласна|персональн|consent/i) || null)?.value || null;
  if (stepPick === "confirm") return (by(/подтверд|записаться|да|confirm/i) || null)?.value || null;
  return null;
}
function resolveStepMessage(step, lastReply, lastUiOptions) {
  if (step.send) return step.send;
  const pickedFromUi = pickFromUi(step.pick, lastUiOptions);
  if (pickedFromUi) return pickedFromUi;
  switch (step.pick) {
    case "location":
      return extractLocations(lastReply)[0] ?? step.fallbackSend ?? "Beauty Salon Center";
    case "time":
      return extractTimes(lastReply)[0] ?? step.fallbackSend ?? null;
    case "service":
      return extractServices(lastReply)[0] ?? step.fallbackSend ?? null;
    case "specialist":
      return extractSpecialists(lastReply)[0] ?? step.fallbackSend ?? null;
    case "consent":
      return "Согласен на обработку персональных данных";
    case "confirm":
      return "да";
    case "mode_self":
      return step.fallbackSend ?? null;
    case "mode_assistant":
      return step.fallbackSend ?? null;
    default:
      return step.fallbackSend ?? "да";
  }
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeReport(report) {
  const outDir = path.join(process.cwd(), "tmp", "aisha-dialog-reports");
  ensureDirSync(outDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `aisha-${report.suite}-${stamp}`;
  const jsonPath = path.join(outDir, `${base}.json`);
  const mdPath = path.join(outDir, `${base}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const lines = [
    `# Aisha Dialog Regression`,
    ``,
    `- Suite: \`${report.suite}\``,
    `- Base URL: \`${report.baseUrl}\``,
    `- Account: \`${report.account}\``,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt ?? "-"}`,
    `- Duration ms: ${report.durationMs ?? 0}`,
    `- Result: ${report.passed ? "PASS" : "FAIL"}`,
    ``,
  ];
  for (const s of report.scenarios) {
    lines.push(`## ${s.passed ? "PASS" : "FAIL"} - ${s.name}`);
    for (const st of s.steps) {
      if (st.skipped) {
        lines.push(`- [SKIP] ${st.index}. ${st.sent}${st.reason ? ` (${st.reason})` : ""}`);
      } else if (st.passed) {
        lines.push(`- [OK] ${st.index}. ${st.sent}`);
      } else {
        lines.push(`- [FAIL] ${st.index}. ${st.sent}`);
        if (st.error) lines.push(`  - Error: ${st.error}`);
      }
    }
    lines.push("");
  }
  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");
  return { jsonPath, mdPath };
}

async function runScenario(scenario, report) {
  let threadId = null;
  let lastReply = "";
  let lastUiOptions = [];
  const scenarioReport = { name: scenario.name, passed: true, steps: [] };
  report.scenarios.push(scenarioReport);
  console.log(`\n[SCENARIO] ${scenario.name}`);

  for (let i = 0; i < scenario.steps.length; i += 1) {
    const step = scenario.steps[i];
    const stepIndex = i + 1;
    const stepLabel = step.send ?? `pick:${step.pick}`;
    if (step.ifReply && !step.ifReply.test(lastReply)) {
      scenarioReport.steps.push({ index: stepIndex, sent: stepLabel, skipped: true, reason: "ifReply" });
      console.log(`  [SKIP] ${stepIndex}. ${stepLabel} (ifReply)`);
      continue;
    }
    if (step.unlessReply && step.unlessReply.test(lastReply)) {
      scenarioReport.steps.push({ index: stepIndex, sent: stepLabel, skipped: true, reason: "unlessReply" });
      console.log(`  [SKIP] ${stepIndex}. ${stepLabel} (unlessReply)`);
      continue;
    }
    const messageToSend = resolveStepMessage(step, lastReply, lastUiOptions);
    if (!messageToSend) {
      scenarioReport.steps.push({ index: stepIndex, sent: stepLabel, skipped: true, reason: "noCandidate" });
      console.log(`  [SKIP] ${stepIndex}. ${stepLabel} (noCandidate)`);
      continue;
    }
    try {
      const { threadId: nextThreadId, reply, uiOptions } = await sendMessage({ message: messageToSend, threadId });
      threadId = Number.isInteger(nextThreadId) && nextThreadId > 0 ? nextThreadId : threadId;
      lastReply = reply;
      lastUiOptions = Array.isArray(uiOptions) ? uiOptions : [];
      assertStep({ scenarioName: scenario.name, stepIndex: i, step, reply });
      scenarioReport.steps.push({ index: stepIndex, sent: messageToSend, passed: true });
      console.log(`  [OK] ${stepIndex}. ${messageToSend}`);
    } catch (err) {
      scenarioReport.passed = false;
      scenarioReport.steps.push({
        index: stepIndex,
        sent: messageToSend,
        passed: false,
        error: err?.message || String(err),
        reply: lastReply,
      });
      console.log(`  [FAIL] ${stepIndex}. ${messageToSend}`);
      throw err;
    }
  }
}

async function main() {
  const startedAt = new Date();
  ACCOUNT = await resolveAccount();
  console.log(`[Aisha Regression] base=${BASE_URL} account=${ACCOUNT} suite=${SUITE}`);

  const report = /** @type {RunReport} */ ({
    suite: SUITE,
    baseUrl: BASE_URL,
    account: ACCOUNT,
    startedAt: startedAt.toISOString(),
    passed: true,
    scenarios: [],
  });

  const targetScenarios = activeScenarios();
  if (!targetScenarios.length) {
    throw new Error(`No scenarios selected for suite='${SUITE}'. Use one of: all, core, booking-e2e, client-actions`);
  }

  try {
    for (const scenario of targetScenarios) {
      await runScenario(scenario, report);
    }
  } catch (err) {
    report.passed = false;
    const finishedAt = new Date();
    report.finishedAt = finishedAt.toISOString();
    report.durationMs = finishedAt.getTime() - startedAt.getTime();
    const paths = writeReport(report);
    console.error("\nRegression failed.");
    console.error(err?.stack || err?.message || String(err));
    console.error(`Report JSON: ${paths.jsonPath}`);
    console.error(`Report MD:   ${paths.mdPath}`);
    process.exit(1);
  }

  const finishedAt = new Date();
  report.finishedAt = finishedAt.toISOString();
  report.durationMs = finishedAt.getTime() - startedAt.getTime();
  const paths = writeReport(report);
  console.log("\nAll scenarios passed.");
  console.log(`Report JSON: ${paths.jsonPath}`);
  console.log(`Report MD:   ${paths.mdPath}`);
}

main().catch((err) => {
  console.error("\nRegression failed.");
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});


