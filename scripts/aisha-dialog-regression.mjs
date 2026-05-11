import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const suiteArg = process.argv.find((arg) => arg.startsWith("--suite="));
const suite = suiteArg ? suiteArg.slice("--suite=".length) : "all";
const allowedSuites = new Set(["all", "core", "booking-e2e", "client-actions", "super"]);

if (!allowedSuites.has(suite)) {
  console.error(`[aisha-regression] Unknown suite: ${suite}`);
  process.exit(2);
}

const file = (path) => resolve(root, path);
const read = (path) => readFileSync(file(path), "utf8");

const requiredFiles = [
  "apps/web/app/api/v1/public/ai/chat/route.ts",
  "apps/web/lib/aisha-chat-post-handler.ts",
  "apps/web/lib/aisha-turn-persistence.ts",
  "apps/web/lib/aisha-fuzzy-resolver.ts",
  "apps/web/lib/aisha-chat-router.ts",
  "apps/web/lib/aisha-route-contract.ts",
  "apps/web/lib/booking-flow.ts",
  "apps/web/components/public-ai-chat-widget.tsx",
];

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok, detail });

for (const path of requiredFiles) {
  check(`required file exists: ${path}`, existsSync(file(path)));
}

const postHandler = read("apps/web/lib/aisha-chat-post-handler.ts");
const fuzzy = read("apps/web/lib/aisha-fuzzy-resolver.ts");
const widget = read("apps/web/components/public-ai-chat-widget.tsx");
const turnPersistence = read("apps/web/lib/aisha-turn-persistence.ts");
const routingHelpers = read("apps/web/lib/aisha-routing-helpers.ts");
const orchestrator = read("apps/web/lib/aisha-orchestrator.ts");
const postprocess = read("apps/web/lib/aisha-chat-postprocess.ts");
const replyBuilder = read("apps/web/lib/aisha-chat-reply-builder.ts");

check(
  "fuzzy resolver does not write directly to Prisma",
  !/\bprisma(?:Any)?\s*\./.test(fuzzy),
  "clarification branches must be persisted through saveTurn",
);

check(
  "entity clarification is saved through saveTurn",
  /entityClarification\.handled[\s\S]*?await saveTurn\(/.test(postHandler),
);

check(
  "unknown service clarification is saved through saveTurn",
  /unknownService\.handled[\s\S]*?await saveTurn\(/.test(postHandler),
);

check(
  "client actions skip booking-domain execution",
  /route === "client-actions"[\s\S]*?\{ handled: false, reply, nextStatus, nextAction, nextUi \}/.test(postHandler),
);

check(
  "booking draft mutation is disabled for client-actions priority",
  /clientActionsHavePriority[\s\S]*?shouldEnrichDraftForBookingResolved[\s\S]*?shouldRunBookingFlowInitial/.test(postHandler),
);

check(
  "public widget uses backend quick reply UI instead of parsing assistant text",
  !/:\s*extractQuickReplies\(msg\.content\)/.test(widget),
);

check(
  "saveTurn writes assistant message, draft, action and log transactionally",
  /prisma\.\$transaction\(\[[\s\S]*prisma\.aiMessage\.create[\s\S]*aiBookingDraft\.update[\s\S]*prisma\.aiAction\.update[\s\S]*prisma\.aiLog\.create/.test(
    turnPersistence,
  ),
);

check(
  "questions about LLM/model/vendor route to identity",
  /что\\s\+ты\\s\+за\\s\+\(\?:llm\|модель/.test(routingHelpers) && /какая\\s\+модель/.test(routingHelpers),
);

check(
  "model/vendor self-identification is treated as sensitive reply",
  /сбер\|sber\|гигачат\|gigachat[\s\S]*llm[\s\S]*нейросетевая модель/.test(routingHelpers),
);

check(
  "smalltalk prompt forbids model and vendor disclosure",
  /Никогда не называй модель, провайдера, разработчика или вендора AI/.test(orchestrator),
);

check(
  "postprocess replaces model/vendor disclosure with assistant identity",
  /Я виртуальный ассистент записи\. Помогаю с услугами, временем, специалистами и оформлением записи\./.test(postprocess),
);

check(
  "identity builder rejects conversational replies with forbidden model identity",
  /forbiddenModelIdentity[\s\S]*сбер\|sber\|гигачат\|gigachat[\s\S]*reply = conversationalReply && hasIdentityCue && !forbiddenModelIdentity/.test(replyBuilder),
);

check(
  "identity builder answers model/vendor questions deterministically in Russian",
  /modelVendorQuestion[\s\S]*Я виртуальный ассистент записи\. Помогаю с услугами, временем, специалистами и оформлением записи\./.test(replyBuilder),
);

check(
  "assistant self-name sanitizes latin Assistent",
  /Assistent\\b\/g,\s*"Ассистент"/.test(routingHelpers),
);

const mojibake = /Р[їС]|Ð|Ñ|�/u;
for (const path of requiredFiles) {
  check(`utf-8 literals look valid: ${path}`, !mojibake.test(read(path)));
}

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  const prefix = item.ok ? "ok" : "FAIL";
  console.log(`[${prefix}] ${item.name}${item.detail && !item.ok ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`[aisha-regression] ${failed.length} check(s) failed for suite ${suite}.`);
  process.exit(1);
}

console.log(`[aisha-regression] suite ${suite} passed (${checks.length} checks).`);
