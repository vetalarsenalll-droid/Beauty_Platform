import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function countState(tag) {
  const [clients, clientUsers, appointments, aiThreadsWithClient] = await Promise.all([
    prisma.client.count(),
    prisma.user.count({ where: { type: "CLIENT" } }),
    prisma.appointment.count(),
    prisma.aiThread.count({ where: { OR: [{ clientId: { not: null } }, { user: { type: "CLIENT" } }] } }),
  ]);
  console.log(`\n[${tag}] clients=${clients}, clientUsers=${clientUsers}, appointments=${appointments}, aiThreads(client-scoped)=${aiThreadsWithClient}`);
}

async function exec(sql) {
  await prisma.$executeRawUnsafe(sql);
}

async function main() {
  await countState("before");

  await prisma.$transaction(async (tx) => {
    const q = async (sql) => tx.$executeRawUnsafe(sql);

    // 1) AI threads/messages/actions/logs/drafts linked to clients or client users
    await q(`DELETE FROM "AiBookingDraft" d USING "AiThread" t WHERE d."threadId" = t.id AND (t."clientId" IS NOT NULL OR t."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT'))`);
    await q(`DELETE FROM "AiMessage" m USING "AiThread" t WHERE m."threadId" = t.id AND (t."clientId" IS NOT NULL OR t."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT'))`);
    await q(`DELETE FROM "AiLog" l USING "AiAction" a, "AiThread" t WHERE l."actionId" = a.id AND a."threadId" = t.id AND (t."clientId" IS NOT NULL OR t."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT'))`);
    await q(`DELETE FROM "AiAction" a USING "AiThread" t WHERE a."threadId" = t.id AND (t."clientId" IS NOT NULL OR t."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT'))`);
    await q(`DELETE FROM "AiThread" t WHERE t."clientId" IS NOT NULL OR t."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);

    // 2) Appointment/payment chain tied to clients
    await q(`DELETE FROM "AppointmentStatusHistory" ash USING "Appointment" ap WHERE ash."appointmentId" = ap.id AND ap."clientId" IS NOT NULL`);
    await q(`DELETE FROM "AppointmentService" aps USING "Appointment" ap WHERE aps."appointmentId" = ap.id AND ap."clientId" IS NOT NULL`);
    await q(`DELETE FROM "LegalAcceptance" la USING "Appointment" ap WHERE la."appointmentId" = ap.id AND ap."clientId" IS NOT NULL`);

    await q(`DELETE FROM "Receipt" r USING "Transaction" tr, "PaymentIntent" pi WHERE r."transactionId" = tr.id AND tr."intentId" = pi.id AND (pi."clientId" IS NOT NULL OR pi."appointmentId" IS NOT NULL)`);
    await q(`DELETE FROM "Refund" rf USING "Transaction" tr, "PaymentIntent" pi WHERE rf."transactionId" = tr.id AND tr."intentId" = pi.id AND (pi."clientId" IS NOT NULL OR pi."appointmentId" IS NOT NULL)`);
    await q(`DELETE FROM "Refund" rf USING "PaymentIntent" pi WHERE rf."intentId" = pi.id AND (pi."clientId" IS NOT NULL OR pi."appointmentId" IS NOT NULL)`);
    await q(`DELETE FROM "Transaction" tr USING "PaymentIntent" pi WHERE tr."intentId" = pi.id AND (pi."clientId" IS NOT NULL OR pi."appointmentId" IS NOT NULL)`);
    await q(`DELETE FROM "PaymentIntent" pi WHERE pi."clientId" IS NOT NULL OR pi."appointmentId" IS NOT NULL`);

    await q(`DELETE FROM "Appointment" ap WHERE ap."clientId" IS NOT NULL`);

    // 3) Other client-linked entities
    await q(`DELETE FROM "MembershipRedemption" mr WHERE mr."clientId" IS NOT NULL`);
    await q(`DELETE FROM "Referral" r WHERE r."referrerClientId" IS NOT NULL OR r."referredClientId" IS NOT NULL`);
    await q(`DELETE FROM "PromoRedemption" pr WHERE pr."clientId" IS NOT NULL`);
    await q(`DELETE FROM "PaymentMethod" pm WHERE pm."clientId" IS NOT NULL`);
    await q(`DELETE FROM "AppointmentHold" ah WHERE ah."clientId" IS NOT NULL`);
    await q(`DELETE FROM "LoyaltyTransaction" lt USING "LoyaltyWallet" lw WHERE lt."walletId" = lw.id AND lw."clientId" IS NOT NULL`);
    await q(`DELETE FROM "LoyaltyWallet" lw WHERE lw."clientId" IS NOT NULL`);

    await q(`DELETE FROM "ReviewVote" rv USING "Review" r WHERE rv."reviewId" = r.id AND r."clientId" IS NOT NULL`);
    await q(`DELETE FROM "Review" r WHERE r."clientId" IS NOT NULL`);
    await q(`DELETE FROM "Favorite" f WHERE f."clientId" IS NOT NULL`);

    await q(`DELETE FROM "ClientConsent" cc WHERE cc."clientId" IS NOT NULL`);
    await q(`DELETE FROM "ClientTagAssignment" cta WHERE cta."clientId" IS NOT NULL`);
    await q(`DELETE FROM "ClientNote" cn WHERE cn."clientId" IS NOT NULL`);
    await q(`DELETE FROM "ClientContact" cc WHERE cc."clientId" IS NOT NULL`);
    await q(`DELETE FROM "LegalAcceptance" la WHERE la."clientId" IS NOT NULL`);

    // 4) Remove clients
    await q(`DELETE FROM "Client"`);

    // 5) Remove users of type CLIENT and their branches
    await q(`DELETE FROM "DeliveryLog" dl USING "OutboxItem" oi WHERE dl."outboxItemId" = oi.id AND oi."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "OutboxItem" oi WHERE oi."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "Notification" n WHERE n."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "NotificationPreference" np WHERE np."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "DeviceToken" dt WHERE dt."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "UserNotificationChannelPreference" p WHERE p."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "UserSession" s WHERE s."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "UserIdentity" ui WHERE ui."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "UserProfile" up WHERE up."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "RoleAssignment" ra WHERE ra."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "LocationManager" lm WHERE lm."userId" IN (SELECT id FROM "User" WHERE type = 'CLIENT')`);
    await q(`DELETE FROM "User" u WHERE u."type" = 'CLIENT'`);

    // 6) Normalize phone format to +7XXXXXXXXXX where possible
    const normExpr = (col) => `
      CASE
        WHEN ${col} IS NULL THEN NULL
        WHEN btrim(${col}) = '' THEN NULL
        ELSE
          CASE
            WHEN length(regexp_replace(${col}, '\\D', '', 'g')) = 11 AND left(regexp_replace(${col}, '\\D', '', 'g'), 1) = '8'
              THEN '+7' || substr(regexp_replace(${col}, '\\D', '', 'g'), 2)
            WHEN length(regexp_replace(${col}, '\\D', '', 'g')) = 11 AND left(regexp_replace(${col}, '\\D', '', 'g'), 1) = '7'
              THEN '+7' || substr(regexp_replace(${col}, '\\D', '', 'g'), 2)
            WHEN length(regexp_replace(${col}, '\\D', '', 'g')) = 10
              THEN '+7' || regexp_replace(${col}, '\\D', '', 'g')
            ELSE btrim(${col})
          END
      END
    `;

    await q(`UPDATE "Client" SET "phone" = ${normExpr('"phone"')} WHERE "phone" IS NOT NULL`);
    await q(`UPDATE "User" SET "phone" = ${normExpr('"phone"')} WHERE "phone" IS NOT NULL`);
    await q(`UPDATE "UserIdentity" SET "phone" = ${normExpr('"phone"')} WHERE "phone" IS NOT NULL`);
    await q(`UPDATE "AccountProfile" SET "phone" = ${normExpr('"phone"')} WHERE "phone" IS NOT NULL`);
    await q(`UPDATE "Location" SET "phone" = ${normExpr('"phone"')} WHERE "phone" IS NOT NULL`);
    await q(`UPDATE "AiBookingDraft" SET "clientPhone" = ${normExpr('"clientPhone"')} WHERE "clientPhone" IS NOT NULL`);
    await q(`UPDATE "ClientContact" SET "value" = ${normExpr('"value"')} WHERE lower("type") IN ('phone', 'телефон') AND "value" IS NOT NULL`);
  });

  await countState("after");

  const [uPhones, apPhones, locPhones] = await Promise.all([
    prisma.user.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true }, take: 20 }),
    prisma.accountProfile.findMany({ where: { phone: { not: null } }, select: { accountId: true, phone: true }, take: 20 }),
    prisma.location.findMany({ where: { phone: { not: null } }, select: { id: true, name: true, phone: true }, take: 20 }),
  ]);
  console.log("\n[phone samples] User:", uPhones);
  console.log("[phone samples] AccountProfile:", apPhones);
  console.log("[phone samples] Location:", locPhones);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
