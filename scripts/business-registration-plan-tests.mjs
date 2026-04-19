import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.REG_PLAN_BASE_URL || "http://127.0.0.1:4010";
const DEV_PORT = process.env.REG_PLAN_PORT || "4010";
const USE_EXISTING_SERVER = process.env.REG_PLAN_USE_EXISTING === "1";
const PASSWORD = "StrongPass123!";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

function makeEmail(seed, suffix) {
  return `plan-${seed}-${suffix}@onlais.test`;
}

async function startAndVerify(email) {
  const start = await post("/api/v1/crm/auth/register/start", {
    email,
    password: PASSWORD,
  });
  assert(start.status === 200, `register/start failed for ${email}`);

  const debugCode = start?.payload?.data?.debugCode;
  if (debugCode) {
    const verify = await post("/api/v1/crm/auth/register/verify-email", {
      email,
      code: debugCode,
    });
    assert(verify.status === 200, `register/verify-email failed for ${email}`);
    return;
  }

  await prisma.emailVerificationToken.updateMany({
    where: { email, purpose: "CRM_REGISTER", consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

async function createSecondAccountForUser(email) {
  const identity = await prisma.userIdentity.findFirst({
    where: { provider: "EMAIL", email },
    select: { userId: true },
  });
  assert(identity?.userId, "user for multi-account scenario not found");

  const account = await prisma.account.create({
    data: {
      name: "ONLAIS Multi Account",
      slug: `onlais-multi-${Date.now()}`,
      timeZone: "Europe/Moscow",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const role = await prisma.role.create({
    data: { accountId: account.id, name: "OWNER" },
    select: { id: true },
  });

  const permission = await prisma.permission.upsert({
    where: { key: "crm.all" },
    update: {},
    create: { key: "crm.all", description: "Полный доступ в CRM" },
    select: { id: true },
  });

  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    update: {},
    create: { roleId: role.id, permissionId: permission.id },
  });

  await prisma.roleAssignment.create({
    data: {
      userId: identity.userId,
      accountId: account.id,
      roleId: role.id,
    },
  });
}

async function runScenarios() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const phone = "+79990001122";

  const emailMain = makeEmail(seed, "ok");
  await startAndVerify(emailMain);
  const completeMain = await post("/api/v1/crm/auth/register/complete", {
    email: emailMain,
    password: PASSWORD,
    businessName: "ONLAIS Yoga",
    legalType: "IP",
    businessType: "YOGA_STUDIO",
    phone,
    timeZone: "Europe/Moscow",
    consents: {
      terms: true,
      privacy: true,
      pdConsent: true,
      dpa: true,
      marketing: false,
    },
  });
  assert(completeMain.status === 201, "успешная регистрация: expected 201");

  const mainUser = await prisma.userIdentity.findFirst({
    where: { provider: "EMAIL", email: emailMain },
    select: { userId: true },
  });
  assert(mainUser?.userId, "успешная регистрация: user not found");

  const mainAssignment = await prisma.roleAssignment.findFirst({
    where: { userId: mainUser.userId },
    include: { account: { include: { publicPages: true } } },
  });
  assert(mainAssignment?.account?.publicPages?.length, "успешная регистрация: publicPage not created");
  const draftJson = mainAssignment.account.publicPages[0].draftJson;
  const draftText = JSON.stringify(draftJson ?? {});
  assert(
    draftText.includes("Онлайн-запись на тренировки и групповые занятия"),
    "автоподстановка текста сайта: expected sport preset text"
  );

  const duplicateEmail = await post("/api/v1/crm/auth/register/start", {
    email: emailMain,
    password: PASSWORD,
  });
  assert(duplicateEmail.status === 409, "дубль email: expected 409");

  const emailPhoneDuplicate = makeEmail(seed, "dup-phone");
  await startAndVerify(emailPhoneDuplicate);
  const duplicatePhone = await post("/api/v1/crm/auth/register/complete", {
    email: emailPhoneDuplicate,
    password: PASSWORD,
    businessName: "ONLAIS Duplicate Phone",
    legalType: "IP",
    businessType: "BEAUTY_SALON",
    phone,
    timeZone: "Europe/Moscow",
    consents: {
      terms: true,
      privacy: true,
      pdConsent: true,
      dpa: true,
      marketing: false,
    },
  });
  assert(duplicatePhone.status === 409, "дубль телефона: expected 409");

  const emailNoConsents = makeEmail(seed, "no-consents");
  await startAndVerify(emailNoConsents);
  const noConsents = await post("/api/v1/crm/auth/register/complete", {
    email: emailNoConsents,
    password: PASSWORD,
    businessName: "ONLAIS No Consents",
    legalType: "IP",
    businessType: "BEAUTY_SALON",
    phone: "+79990002233",
    timeZone: "Europe/Moscow",
    consents: {
      terms: true,
      privacy: true,
      pdConsent: true,
      dpa: false,
      marketing: false,
    },
  });
  assert(noConsents.status === 400, "отсутствие обязательных согласий: expected 400");

  const emailExpired = makeEmail(seed, "expired");
  const expiredStart = await post("/api/v1/crm/auth/register/start", {
    email: emailExpired,
    password: PASSWORD,
  });
  assert(expiredStart.status === 200, "истечение токена: start should be 200");
  await prisma.emailVerificationToken.updateMany({
    where: { email: emailExpired, purpose: "CRM_REGISTER", consumedAt: null },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const expiredVerify = await post("/api/v1/crm/auth/register/verify-email", {
    email: emailExpired,
    code: String(expiredStart?.payload?.data?.debugCode ?? "000000"),
  });
  assert(expiredVerify.status === 400, "истечение токена подтверждения: expected 400");

  await createSecondAccountForUser(emailMain);
  const multiLogin = await post("/api/v1/crm/auth/login", {
    email: emailMain,
    password: PASSWORD,
  });
  assert(multiLogin.status === 200, "логин мультиаккаунта: expected 200");
  assert(
    Boolean(multiLogin?.payload?.data?.requiresAccountSelection),
    "логин мультиаккаунта: expected requiresAccountSelection=true"
  );
  assert(
    Array.isArray(multiLogin?.payload?.data?.accounts) &&
      multiLogin.payload.data.accounts.length >= 2,
    "логин мультиаккаунта: expected accounts[] >= 2"
  );

  const emailInvalidBusiness = makeEmail(seed, "bad-business");
  await startAndVerify(emailInvalidBusiness);
  const invalidBusiness = await post("/api/v1/crm/auth/register/complete", {
    email: emailInvalidBusiness,
    password: PASSWORD,
    businessName: "ONLAIS Invalid Business",
    legalType: "IP",
    businessType: "INVALID_KEY",
    phone: "+79990003344",
    timeZone: "Europe/Moscow",
    consents: {
      terms: true,
      privacy: true,
      pdConsent: true,
      dpa: true,
      marketing: false,
    },
  });
  assert(invalidBusiness.status === 400, "валидатор businessType: expected 400");

  console.log("All BUSINESS_REGISTRATION_PLAN scenarios passed.");
}

async function waitForServerReady(proc, timeoutMs = 90_000) {
  const startedAt = Date.now();
  let collected = "";

  const onData = (data) => {
    collected += data.toString("utf8");
    if (collected.length > 8000) {
      collected = collected.slice(-8000);
    }
  };

  proc.stdout?.on("data", onData);
  proc.stderr?.on("data", onData);

  while (Date.now() - startedAt < timeoutMs) {
    if (collected.includes("Ready") || collected.includes("Local:")) {
      proc.stdout?.off("data", onData);
      proc.stderr?.off("data", onData);
      return;
    }
    await delay(300);
  }

  proc.stdout?.off("data", onData);
  proc.stderr?.off("data", onData);
  throw new Error(`Next server did not become ready in ${timeoutMs}ms.\n${collected}`);
}

async function main() {
  if (USE_EXISTING_SERVER) {
    try {
      await runScenarios();
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  const dev = spawn(
    "npm",
    ["--workspace", "apps/web", "run", "dev", "--", "--port", String(DEV_PORT)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    }
  );

  const onData = (data) => {
    process.stdout.write(data.toString("utf8"));
  };
  dev.stdout?.on("data", onData);
  dev.stderr?.on("data", onData);

  try {
    await waitForServerReady(dev);
    await runScenarios();
  } finally {
    dev.kill("SIGTERM");
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
