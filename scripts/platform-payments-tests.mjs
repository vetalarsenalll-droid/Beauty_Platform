import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { PrismaClient } from "@prisma/client";

function loadDotEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ||= value;
  }
}

loadDotEnvIfNeeded();

const root = process.cwd();
const jiti = createJiti(path.join(root, "apps/web/test-entry.js"), {
  alias: { "@": path.join(root, "apps/web") },
});

process.env.TBANK_PASSWORD = "test_password";
process.env.TBANK_TERMINAL_KEY = "test_terminal";

const { rubToKopecks } = jiti("./lib/payments/money.ts");
const {
  buildTbankToken,
  isTbankFinalSuccessStatus,
  parseInvoiceIdFromTbankOrderId,
  paymentMethodFromTbankPayload,
  tbankPaymentProvider,
} = jiti("./lib/payments/providers/tbank.ts");
const { applySuccessfulPlatformPayment } = jiti("./lib/payments/apply-payment.ts");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("rubToKopecks converts rubles to integer kopecks", () => {
  assert.equal(rubToKopecks("99"), 9900);
  assert.equal(rubToKopecks("99.99"), 9999);
  assert.equal(rubToKopecks("99.995"), 10000);
  assert.equal(rubToKopecks(0), 0);
});

test("T-Bank token sorts top-level scalar fields and ignores nested values", () => {
  const payload = {
    TerminalKey: "test_terminal",
    Amount: 9900,
    OrderId: "platform_invoice_123",
    Description: "AI package",
    Receipt: { Email: "client@example.com" },
    DATA: { invoiceId: "123" },
    Token: "must_be_ignored",
  };

  const expected = sha256("9900AI packageplatform_invoice_123test_passwordtest_terminal");
  assert.equal(buildTbankToken(payload, "test_password"), expected);
});

test("T-Bank webhook verification accepts valid token and rejects changed payload", async () => {
  const payload = {
    TerminalKey: "test_terminal",
    OrderId: "platform_invoice_321",
    PaymentId: "987654",
    Status: "CONFIRMED",
    Amount: 9900,
  };
  const signedPayload = {
    ...payload,
    Token: buildTbankToken(payload, "test_password"),
  };

  const valid = await tbankPaymentProvider.verifyWebhook({ payload: signedPayload });
  assert.equal(valid.valid, true);
  assert.equal(valid.providerPaymentId, "987654");
  assert.equal(valid.orderId, "platform_invoice_321");
  assert.equal(valid.status, "CONFIRMED");

  const invalid = await tbankPaymentProvider.verifyWebhook({
    payload: { ...signedPayload, Amount: 10000 },
  });
  assert.equal(invalid.valid, false);
});

test("T-Bank helper functions parse invoice, method, and final statuses", () => {
  assert.equal(parseInvoiceIdFromTbankOrderId("platform_invoice_42"), 42);
  assert.equal(parseInvoiceIdFromTbankOrderId("platform_invoice_42_lx9v2k"), 42);
  assert.equal(parseInvoiceIdFromTbankOrderId("bad_42"), null);
  assert.equal(isTbankFinalSuccessStatus("CONFIRMED"), true);
  assert.equal(isTbankFinalSuccessStatus("AUTHORIZED"), false);
  assert.equal(isTbankFinalSuccessStatus("REJECTED"), false);
  assert.equal(paymentMethodFromTbankPayload({ DATA: { paymentMethod: "sbp" } }), "sbp");
  assert.equal(paymentMethodFromTbankPayload({ DATA: { paymentMethod: "cash" } }), null);
});

test("applySuccessfulPlatformPayment marks AI invoice paid and is idempotent", async () => {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const prisma = new PrismaClient();
  const suffix = `payments-test-${Date.now()}`;
  let accountId;
  let packageId;
  let invoiceId;

  try {
    const plan = await prisma.platformPlan.create({
      data: {
        name: suffix,
        code: suffix,
        priceMonthly: "0",
      },
    });
    const account = await prisma.account.create({
      data: {
        name: suffix,
        slug: suffix,
        timeZone: "Europe/Moscow",
        planId: plan.id,
      },
    });
    accountId = account.id;

    const aiPackage = await prisma.aiAccessPackage.create({
      data: {
        code: suffix,
        name: "Test AI package",
        includedCreditRub: "99",
        displayTokens: 1000000,
        priceRub: "99",
      },
    });
    packageId = aiPackage.id;

    const invoice = await prisma.platformInvoice.create({
      data: {
        accountId,
        status: "ISSUED",
        purpose: "AI_TOKENS",
        amount: "99",
        currency: "RUB",
        description: "Test AI package",
      },
    });
    invoiceId = invoice.id;

    await prisma.$executeRaw`
      INSERT INTO "AiAccessPurchase"
        ("accountId", "packageId", "invoiceId", "amountRub", "creditRub", "creditTokens", "status")
      VALUES
        (${accountId}, ${packageId}, ${invoiceId}, 99, 99, 1000000, 'PENDING')
    `;

    await applySuccessfulPlatformPayment({
      invoiceId,
      provider: "tbank",
      providerPaymentId: `pay_${suffix}`,
      method: "card",
      providerStatus: "CONFIRMED",
      rawProviderJson: { test: true },
    });
    await applySuccessfulPlatformPayment({
      invoiceId,
      provider: "tbank",
      providerPaymentId: `pay_${suffix}`,
      method: "card",
      providerStatus: "CONFIRMED",
      rawProviderJson: { test: true, duplicate: true },
    });

    const paidInvoice = await prisma.platformInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    assert.equal(paidInvoice.status, "PAID");

    const purchases = await prisma.$queryRaw`
      SELECT "status"
      FROM "AiAccessPurchase"
      WHERE "invoiceId" = ${invoiceId}
    `;
    assert.equal(purchases[0].status, "PAID");

    const ledgerRows = await prisma.aiBalanceLedger.findMany({
      where: { accountId, type: "purchase" },
    });
    assert.equal(ledgerRows.length, 1);
    assert.equal(Number(ledgerRows[0].amountRub), 99);
    assert.equal(ledgerRows[0].amountTokens, 1000000);
  } finally {
    if (accountId) {
      await prisma.aiBalanceLedger.deleteMany({ where: { accountId } });
      await prisma.$executeRaw`DELETE FROM "AiAccessPurchase" WHERE "accountId" = ${accountId}`;
      await prisma.platformPayment.deleteMany({ where: { invoiceId } });
      await prisma.platformInvoiceItem.deleteMany({ where: { invoiceId } });
      await prisma.platformInvoice.deleteMany({ where: { accountId } });
      await prisma.aiAccessPackage.deleteMany({ where: { id: packageId } });
      await prisma.account.deleteMany({ where: { id: accountId } });
      await prisma.platformPlan.deleteMany({ where: { code: suffix } });
    }
    await prisma.$disconnect();
  }
});

test("applySuccessfulPlatformPayment activates subscription invoice plan", async () => {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const prisma = new PrismaClient();
  const suffix = `subscription-payment-test-${Date.now()}`;
  let accountId;
  let firstPlanId;
  let paidPlanId;
  let invoiceId;

  try {
    const firstPlan = await prisma.platformPlan.create({
      data: {
        name: `${suffix}-first`,
        code: `${suffix}-first`,
        priceMonthly: "100",
      },
    });
    firstPlanId = firstPlan.id;

    const paidPlan = await prisma.platformPlan.create({
      data: {
        name: `${suffix}-paid`,
        code: `${suffix}-paid`,
        priceMonthly: "500",
      },
    });
    paidPlanId = paidPlan.id;

    const account = await prisma.account.create({
      data: {
        name: suffix,
        slug: suffix,
        timeZone: "Europe/Moscow",
        planId: firstPlanId,
      },
    });
    accountId = account.id;

    const invoice = await prisma.platformInvoice.create({
      data: {
        accountId,
        status: "ISSUED",
        purpose: "SUBSCRIPTION",
        amount: "500",
        currency: "RUB",
        description: "Subscription test invoice",
        metadataJson: { planId: paidPlanId, billingPeriod: "month" },
      },
    });
    invoiceId = invoice.id;

    await applySuccessfulPlatformPayment({
      invoiceId,
      provider: "tbank",
      providerPaymentId: `subscription_pay_${suffix}`,
      method: "card",
      providerStatus: "CONFIRMED",
      rawProviderJson: { test: true },
    });

    const paidInvoice = await prisma.platformInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    assert.equal(paidInvoice.status, "PAID");

    const subscription = await prisma.platformSubscription.findFirstOrThrow({
      where: { accountId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(subscription.planId, paidPlanId);
    assert(subscription.nextBillingAt, "subscription should have next billing date");

    const updatedAccount = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    assert.equal(updatedAccount.planId, paidPlanId);
  } finally {
    if (accountId) {
      await prisma.platformPayment.deleteMany({ where: { invoiceId } });
      await prisma.platformInvoice.deleteMany({ where: { accountId } });
      await prisma.platformSubscription.deleteMany({ where: { accountId } });
      await prisma.account.deleteMany({ where: { id: accountId } });
    }
    if (paidPlanId) await prisma.platformPlan.deleteMany({ where: { id: paidPlanId } });
    if (firstPlanId) await prisma.platformPlan.deleteMany({ where: { id: firstPlanId } });
    await prisma.$disconnect();
  }
});
