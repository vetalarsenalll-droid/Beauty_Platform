const { PrismaClient, RoleName, ScheduleEntryType, UserStatus, UserType } = require("@prisma/client");

const prisma = new PrismaClient();

const ACCOUNT = {
  name: "Салон красоты Северная Орхидея",
  slug: "severnaya-orhideya",
  timeZone: "Europe/Moscow",
};

const LOCATION_DATA = [
  {
    code: "A",
    name: "Северная Орхидея — Центр",
    address: "Санкт-Петербург, Невский проспект, 24",
    description: "Центральный филиал: парикмахерский зал, ногтевой сервис и ресницы.",
    phone: "+78121230001",
  },
  {
    code: "B",
    name: "Северная Орхидея — Петроградская",
    address: "Санкт-Петербург, Каменноостровский проспект, 18",
    description: "Филиал на Петроградской: парикмахерский зал, ногтевой сервис и брови.",
    phone: "+78121230002",
  },
  {
    code: "C",
    name: "Северная Орхидея — Московская",
    address: "Санкт-Петербург, Московский проспект, 151",
    description: "Филиал под расширение: консультации и спецсобытия.",
    phone: "+78121230003",
  },
];

const SPECIALIST_NAMES = [
  "Анна Смирнова",
  "Екатерина Орлова",
  "Мария Власова",
  "Ольга Кузнецова",
  "Ирина Белова",
  "Наталья Морозова",
  "Татьяна Егорова",
  "Светлана Макарова",
  "Елена Данилова",
  "Ксения Романова",
  "Дарья Фролова",
  "Юлия Захарова",
  "Полина Лебедева",
  "Виктория Соколова",
  "Алиса Тихонова",
];

const serviceGroups = {
  hair: [
    { name: "Женская стрижка", duration: 60, price: 2200 },
    { name: "Мужская стрижка", duration: 45, price: 1500 },
    { name: "Детская стрижка", duration: 40, price: 1300 },
    { name: "Окрашивание в один тон", duration: 120, price: 4200 },
    { name: "Сложное окрашивание", duration: 180, price: 7200 },
    { name: "Тонирование волос", duration: 90, price: 3200 },
    { name: "Укладка вечерняя", duration: 75, price: 2800 },
    { name: "Полировка волос", duration: 60, price: 2600 },
    { name: "Кератиновое восстановление", duration: 150, price: 6800 },
    { name: "Уход для кожи головы", duration: 45, price: 2400 },
  ],
  nails: [
    { name: "Маникюр классический", duration: 60, price: 1700 },
    { name: "Маникюр аппаратный", duration: 75, price: 2100 },
    { name: "Покрытие гель-лаком", duration: 90, price: 2400 },
    { name: "Снятие гель-лака", duration: 30, price: 800 },
    { name: "Наращивание ногтей", duration: 150, price: 4200 },
    { name: "Коррекция ногтей", duration: 120, price: 3200 },
    { name: "Педикюр классический", duration: 75, price: 2300 },
    { name: "Педикюр SMART", duration: 90, price: 2900 },
    { name: "SPA-уход для рук", duration: 40, price: 1500 },
    { name: "Дизайн ногтей", duration: 30, price: 900 },
  ],
  lashes: [
    { name: "Наращивание ресниц 1D", duration: 120, price: 3200 },
    { name: "Наращивание ресниц 2D", duration: 150, price: 3900 },
    { name: "Ламинирование ресниц", duration: 75, price: 2800 },
    { name: "Окрашивание ресниц", duration: 30, price: 1100 },
    { name: "Снятие ресниц", duration: 30, price: 900 },
  ],
  brows: [
    { name: "Коррекция бровей", duration: 30, price: 1200 },
    { name: "Окрашивание бровей", duration: 40, price: 1400 },
    { name: "Ламинирование бровей", duration: 60, price: 2500 },
    { name: "Архитектура бровей", duration: 50, price: 1900 },
    { name: "Долговременная укладка бровей", duration: 70, price: 2600 },
  ],
};

function parseName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] || null, lastName: parts.slice(1).join(" ") || null };
}

function minutesToTime(m) {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function dateUtc(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function buildMarchDates() {
  const out = [];
  for (let day = 1; day <= 31; day += 1) out.push(dateUtc(2026, 3, day));
  return out;
}

async function cleanupAllAccountsData() {
  const keep = [
    "_prisma_migrations",
    "Permission",
    "PlatformPermission",
    "User",
    "UserIdentity",
    "UserProfile",
    "PlatformAdmin",
    "PlatformAdminPermissionAssignment",
    "PlatformAuditLog",
    "PlatformSetting",
    "PlatformLegalDocument",
    "PlatformLegalDocumentVersion",
  ];

  const keepSql = keep.map((x) => `'${x.replace(/'/g, "''")}'`).join(",");
  const sql = `
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (${keepSql})
  LOOP
    EXECUTE format('TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE', 'public', r.tablename);
  END LOOP;
END $$;
`;

  await prisma.$executeRawUnsafe(sql);
}

async function ensurePermissions() {
  const crmKeys = [
    "crm.all",
    "crm.locations.read",
    "crm.services.read",
    "crm.specialists.read",
    "crm.schedule.read",
    "crm.calendar.read",
    "crm.appointments.create",
    "crm.appointments.update",
    "crm.appointments.cancel",
    "crm.appointments.reschedule",
    "crm.clients.read",
    "crm.payments.read",
    "crm.promos.read",
    "crm.loyalty.read",
    "crm.analytics.read",
    "crm.settings.read",
    "crm.settings.update",
  ];

  for (const key of crmKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  await prisma.platformPermission.upsert({
    where: { key: "platform.all" },
    update: {},
    create: { key: "platform.all", description: "Полный доступ платформы" },
  });
}

async function resolveOwnerUser() {
  const preferredEmails = ["owner@beauty.local", "admin@beauty.local"];
  for (const email of preferredEmails) {
    const found = await prisma.user.findUnique({ where: { email } });
    if (found) return found;
  }

  const platformAdmin = await prisma.platformAdmin.findFirst({ include: { user: true }, orderBy: { id: "asc" } });
  if (platformAdmin?.user) return platformAdmin.user;

  const created = await prisma.user.create({
    data: {
      email: "owner@beauty.local",
      status: UserStatus.ACTIVE,
      type: UserType.STAFF,
      identities: {
        create: {
          provider: "EMAIL",
          providerUserId: "owner@beauty.local",
          email: "owner@beauty.local",
          passwordHash: "0ec8f2c9985c78cc6bc179b028bc3f85a34233a33281aaed7df07b0efb724c96",
          passwordSalt: "ea1eeb9af1e9e987fd41842f2f3cd6a4",
          passwordAlgo: "scrypt",
          passwordUpdatedAt: new Date(),
        },
      },
      profile: { create: { firstName: "Владелец", lastName: "Салона" } },
    },
  });
  return created;
}

async function main() {
  console.log("1) Очистка аккаунтных данных...");
  await cleanupAllAccountsData();

  console.log("2) Восстановление прав...");
  await ensurePermissions();

  console.log("3) Создание аккаунта...");
  const ownerUser = await resolveOwnerUser();

  const account = await prisma.account.create({
    data: {
      name: ACCOUNT.name,
      slug: ACCOUNT.slug,
      status: "ACTIVE",
      timeZone: ACCOUNT.timeZone,
      profile: {
        create: {
          description: "Сеть салонов красоты в Санкт-Петербурге: волосы, ногти, ресницы и брови.",
          phone: "+78121230000",
          email: "hello@sevorchid.ru",
          address: "Санкт-Петербург",
          websiteUrl: "https://sevorchid.local",
        },
      },
      settings: {
        create: {
          slotStepMinutes: 15,
          holdTtlMinutes: 5,
          cancellationWindowHours: 24,
          rescheduleWindowHours: 24,
          requireDeposit: false,
          requirePaymentToConfirm: false,
          defaultReminderHours: 24,
        },
      },
    },
  });

  const ownerRole = await prisma.role.create({
    data: { accountId: account.id, name: RoleName.OWNER },
  });
  await prisma.role.createMany({
    data: [
      { accountId: account.id, name: RoleName.MANAGER },
      { accountId: account.id, name: RoleName.SPECIALIST },
      { accountId: account.id, name: RoleName.READONLY },
    ],
  });

  const allPerms = await prisma.permission.findMany({ select: { id: true } });
  await prisma.rolePermission.createMany({
    data: allPerms.map((p) => ({ roleId: ownerRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  await prisma.roleAssignment.create({
    data: {
      userId: ownerUser.id,
      accountId: account.id,
      roleId: ownerRole.id,
    },
  });

  console.log("4) Создание локаций...");
  const locations = [];
  for (const item of LOCATION_DATA) {
    const loc = await prisma.location.create({
      data: {
        accountId: account.id,
        name: item.name,
        address: item.address,
        description: item.description,
        phone: item.phone,
        status: "ACTIVE",
      },
    });
    locations.push({ ...item, id: loc.id });

    await prisma.locationHour.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
        locationId: loc.id,
        dayOfWeek: dow,
        startTime: "10:00",
        endTime: "20:00",
      })),
    });
  }

  const locA = locations.find((x) => x.code === "A");
  const locB = locations.find((x) => x.code === "B");
  const locC = locations.find((x) => x.code === "C");

  console.log("5) Создание уровней специалистов...");
  const levels = await prisma.$transaction([
    prisma.specialistLevel.create({ data: { accountId: account.id, name: "Начинающий", rank: 1 } }),
    prisma.specialistLevel.create({ data: { accountId: account.id, name: "Опытный", rank: 2 } }),
    prisma.specialistLevel.create({ data: { accountId: account.id, name: "Топ-мастер", rank: 3 } }),
  ]);

  console.log("6) Создание услуг (30)...");
  const categoryHair = await prisma.serviceCategory.create({ data: { accountId: account.id, name: "Парикмахерские услуги", slug: "parikmaherskie" } });
  const categoryNails = await prisma.serviceCategory.create({ data: { accountId: account.id, name: "Ногтевой сервис", slug: "nogtevoj" } });
  const categoryLashes = await prisma.serviceCategory.create({ data: { accountId: account.id, name: "Ресницы", slug: "resnicy" } });
  const categoryBrows = await prisma.serviceCategory.create({ data: { accountId: account.id, name: "Брови", slug: "brovi" } });

  const services = [];
  const makeService = async (row, categoryId, description, locationCodes) => {
    const service = await prisma.service.create({
      data: {
        accountId: account.id,
        categoryId,
        name: row.name,
        description,
        baseDurationMin: row.duration,
        basePrice: row.price,
        isActive: true,
      },
    });

    const locIds = locationCodes.map((code) => locations.find((x) => x.code === code)?.id).filter(Boolean);
    await prisma.serviceLocation.createMany({
      data: locIds.map((locationId) => ({ serviceId: service.id, locationId })),
      skipDuplicates: true,
    });

    for (const lvl of levels) {
      const factor = lvl.rank === 1 ? 1 : lvl.rank === 2 ? 1.12 : 1.27;
      const durationShift = lvl.rank === 1 ? 10 : lvl.rank === 2 ? 0 : -10;
      const durationMin = Math.max(20, row.duration + durationShift);
      const price = Math.round(row.price * factor);
      await prisma.serviceLevelConfig.create({
        data: {
          serviceId: service.id,
          levelId: lvl.id,
          durationMin,
          price,
        },
      });
    }

    services.push({ ...service, locationCodes });
  };

  for (const row of serviceGroups.hair) {
    await makeService(row, categoryHair.id, "Профессиональная услуга для волос с учетом типа волос и пожеланий клиента.", ["A", "B"]);
  }
  for (const row of serviceGroups.nails) {
    await makeService(row, categoryNails.id, "Комплексный ногтевой сервис с соблюдением санитарных стандартов.", ["A", "B"]);
  }
  for (const row of serviceGroups.lashes) {
    await makeService(row, categoryLashes.id, "Услуги по ресницам в филиале Центр.", ["A"]);
  }
  for (const row of serviceGroups.brows) {
    await makeService(row, categoryBrows.id, "Услуги по оформлению бровей в филиале Петроградская.", ["B"]);
  }

  const servicesHairNails = services.filter((s) => s.locationCodes.includes("A") && s.locationCodes.includes("B"));
  const servicesLashes = services.filter((s) => s.locationCodes.length === 1 && s.locationCodes[0] === "A");
  const servicesBrows = services.filter((s) => s.locationCodes.length === 1 && s.locationCodes[0] === "B");

  console.log("7) Создание специалистов (15) и привязок...");

  const specialistEmails = SPECIALIST_NAMES.map((_, i) => `spec${String(i + 1).padStart(2, "0")}@sevorchid.local`);
  const staleUsers = await prisma.user.findMany({
    where: { email: { in: specialistEmails } },
    select: { id: true },
  });
  const staleUserIds = staleUsers.map((x) => x.id);
  if (staleUserIds.length) {
    await prisma.userProfile.deleteMany({ where: { userId: { in: staleUserIds } } });
    await prisma.userIdentity.deleteMany({ where: { userId: { in: staleUserIds } } });
    await prisma.userSession.deleteMany({ where: { userId: { in: staleUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: staleUserIds } } });
  }

  const specialists = [];
  for (let i = 0; i < SPECIALIST_NAMES.length; i += 1) {
    const fullName = SPECIALIST_NAMES[i];
    const { firstName, lastName } = parseName(fullName);
    const email = `spec${String(i + 1).padStart(2, "0")}@sevorchid.local`;

    const user = await prisma.user.create({
      data: {
        email,
        status: UserStatus.ACTIVE,
        type: UserType.STAFF,
        profile: { create: { firstName, lastName } },
      },
    });

    const level = levels[i % levels.length];
    const specialist = await prisma.specialistProfile.create({
      data: {
        accountId: account.id,
        userId: user.id,
        levelId: level.id,
        bio: `Специалист: ${fullName}. Опыт в индустрии красоты и внимательный подход к клиенту.`,
      },
    });

    const group = i < 5 ? "A" : i < 10 ? "B" : "AB";
    const locationIds = group === "A" ? [locA.id] : group === "B" ? [locB.id] : [locA.id, locB.id];

    await prisma.specialistLocation.createMany({
      data: locationIds.map((locationId) => ({ specialistId: specialist.id, locationId })),
      skipDuplicates: true,
    });

    let allowedServices = [...servicesHairNails];
    if (group === "A") allowedServices = allowedServices.concat(servicesLashes);
    if (group === "B") allowedServices = allowedServices.concat(servicesBrows);
    if (group === "AB") {
      const lashPick = servicesLashes[i % servicesLashes.length];
      const browPick = servicesBrows[i % servicesBrows.length];
      allowedServices = allowedServices.concat([lashPick, browPick].filter(Boolean));
    }

    await prisma.specialistService.createMany({
      data: allowedServices.map((s) => ({ specialistId: specialist.id, serviceId: s.id })),
      skipDuplicates: true,
    });

    specialists.push({ id: specialist.id, group, levelId: level.id, fullName, locationIds });
  }

  console.log("8) Расписание на март 2026...");
  const marchDates = buildMarchDates();
  for (let idx = 0; idx < specialists.length; idx += 1) {
    const sp = specialists[idx];
    const sickDays = new Set([5 + (idx % 3), 18 + (idx % 4)]);
    const offDays = new Set([12 + (idx % 2)]);

    for (const date of marchDates) {
      const dayNum = date.getUTCDate();
      const dow = date.getUTCDay();

      let type = ScheduleEntryType.WORKING;
      let startTime = "10:00";
      let endTime = "20:00";
      let notes = null;

      if (sickDays.has(dayNum) && dow !== 0 && dow !== 6) {
        type = ScheduleEntryType.SICK;
        startTime = null;
        endTime = null;
        notes = "Больничный";
      } else if (offDays.has(dayNum) && dow !== 0 && dow !== 6) {
        type = ScheduleEntryType.PAID_OFF;
        startTime = null;
        endTime = null;
        notes = "Отгул";
      } else if (dow === 0) {
        type = ScheduleEntryType.VACATION;
        startTime = null;
        endTime = null;
        notes = "Выходной";
      } else if (dow === 6) {
        type = ScheduleEntryType.UNPAID_OFF;
        startTime = null;
        endTime = null;
        notes = "Выходной";
      }

      const locationId =
        type !== ScheduleEntryType.WORKING
          ? null
          : sp.group === "A"
          ? locA.id
          : sp.group === "B"
          ? locB.id
          : dayNum % 2 === 0
          ? locA.id
          : locB.id;

      const entry = await prisma.scheduleEntry.create({
        data: {
          accountId: account.id,
          specialistId: sp.id,
          locationId,
          date,
          type,
          startTime,
          endTime,
          notes,
        },
      });

      if (type === ScheduleEntryType.WORKING) {
        await prisma.scheduleEntryBreak.create({
          data: {
            entryId: entry.id,
            startTime: "14:00",
            endTime: "15:00",
          },
        });
      }
    }
  }

  console.log("9) Итоговая проверка...");
  const [
    accountsCount,
    locationsCount,
    specialistsCount,
    servicesCount,
    levelCount,
    scheduleCount,
    serviceLocationCount,
    specialistLocationCount,
    specialistServiceCount,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.location.count({ where: { accountId: account.id } }),
    prisma.specialistProfile.count({ where: { accountId: account.id } }),
    prisma.service.count({ where: { accountId: account.id } }),
    prisma.specialistLevel.count({ where: { accountId: account.id } }),
    prisma.scheduleEntry.count({ where: { accountId: account.id } }),
    prisma.serviceLocation.count({ where: { service: { accountId: account.id } } }),
    prisma.specialistLocation.count({ where: { specialist: { accountId: account.id } } }),
    prisma.specialistService.count({ where: { specialist: { accountId: account.id } } }),
  ]);

  console.log("✅ Готово.");
  console.log({
    accountId: account.id,
    accountSlug: account.slug,
    ownerUserId: ownerUser.id,
    counts: {
      accountsTotal: accountsCount,
      locations: locationsCount,
      specialists: specialistsCount,
      services: servicesCount,
      specialistLevels: levelCount,
      scheduleEntries: scheduleCount,
      serviceLocations: serviceLocationCount,
      specialistLocations: specialistLocationCount,
      specialistServices: specialistServiceCount,
    },
  });

  const groupStats = {
    onlyA: specialists.filter((x) => x.group === "A").length,
    onlyB: specialists.filter((x) => x.group === "B").length,
    bothAB: specialists.filter((x) => x.group === "AB").length,
  };
  console.log("Специалисты по группам:", groupStats);

  const locStats = await prisma.location.findMany({
    where: { accountId: account.id },
    select: {
      name: true,
      _count: { select: { specialists: true, services: true } },
    },
    orderBy: { id: "asc" },
  });
  console.log("Локации:", locStats);

  if (locC?.id) {
    await prisma.locationHour.createMany({
      data: [
        { locationId: locC.id, dayOfWeek: 1, startTime: "11:00", endTime: "19:00" },
        { locationId: locC.id, dayOfWeek: 3, startTime: "11:00", endTime: "19:00" },
        { locationId: locC.id, dayOfWeek: 5, startTime: "11:00", endTime: "19:00" },
      ],
      skipDuplicates: true,
    });
  }
}

main()
  .catch((err) => {
    console.error("❌ Ошибка reseed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
