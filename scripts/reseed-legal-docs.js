const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const buildDefaultDocs = (input) => {
  const operator = input.operatorName || "Организация";
  const location = input.locationName || operator;
  const address = input.address || "адрес будет уточнен";
  const phone = input.phone || "телефон будет уточнен";
  const website = input.website ? `Сайт: ${input.website}\n` : "";

  return [
    {
      key: "privacy-policy",
      title: "Политика обработки персональных данных",
      description: "Правила обработки и защиты персональных данных клиента.",
      isRequired: false,
      sortOrder: 1,
      content: `Политика обработки персональных данных\n\n1. Общие положения\n1.1. Оператор персональных данных: ${operator}.\n1.2. Настоящая Политика определяет порядок обработки и защиты персональных данных клиентов ${operator}.\n\n2. Состав персональных данных\n2.1. ФИО, телефон, e-mail, сведения о записи, комментарии клиента.\n2.2. Технические данные: IP-адрес, user-agent, cookies (при необходимости).\n\n3. Цели обработки\n3.1. Создание и управление записью на услуги.\n3.2. Информирование о записи, напоминания, изменение/отмена.\n3.3. Улучшение качества сервиса и аналитика.\n\n4. Правовые основания\n4.1. Согласие клиента на обработку персональных данных.\n4.2. Необходимость исполнения договора оказания услуг.\n\n5. Условия обработки и хранения\n5.1. Данные обрабатываются с соблюдением требований законодательства РФ.\n5.2. Данные хранятся в течение срока, необходимого для целей обработки, либо до отзыва согласия.\n\n6. Передача данных третьим лицам\n6.1. Данные могут передаваться подрядчикам (хостинг, рассылки) строго для целей оказания услуг и при соблюдении конфиденциальности.\n\n7. Права субъекта персональных данных\n7.1. Клиент вправе запросить информацию о своих данных, потребовать исправления или удаления.\n7.2. Клиент вправе отозвать согласие на обработку персональных данных.\n\n8. Безопасность\n8.1. Оператор принимает технические и организационные меры защиты данных.\n\n9. Контакты\n9.1. ${operator}\n9.2. Адрес: ${address}\n9.3. Телефон: ${phone}\n${website}`.trim(),
    },
    {
      key: "personal-data-consent",
      title: "Согласие на обработку персональных данных",
      description: "Согласие клиента на обработку персональных данных.",
      isRequired: true,
      sortOrder: 2,
      content: `Согласие на обработку персональных данных\n\nЯ подтверждаю, что даю согласие ${operator} на обработку моих персональных данных для целей: создания и управления записью, связи со мной, отправки уведомлений и напоминаний, а также улучшения качества сервиса.\n\nСогласие дается на обработку следующих данных: ФИО, телефон, e-mail, сведения о записи и комментарии.\n\nСогласие может быть отозвано мной в любой момент путем обращения в ${operator}.\n\nПодтверждая согласие, я ознакомлен(а) с Политикой обработки персональных данных.`.trim(),
    },
    {
      key: "service-agreement",
      title: "Пользовательское соглашение (публичная оферта)",
      description: "Условия оказания услуг и правила использования сервиса.",
      isRequired: true,
      sortOrder: 3,
      content: `Пользовательское соглашение (публичная оферта)\n\n1. Предмет\n1.1. ${operator} (Исполнитель) обязуется оказать услуги, выбранные клиентом, а клиент обязуется оплатить услуги (если требуется).\n\n2. Запись и отмена\n2.1. Запись считается подтвержденной после согласования условий и, при необходимости, оплаты/депозита.\n2.2. Условия отмены и переноса указаны в правилах отмены/переноса.\n\n3. Оплата\n3.1. Способы оплаты и необходимость депозита определяются настройками аккаунта.\n\n4. Ответственность\n4.1. Исполнитель не несет ответственности за неверно указанные клиентом контактные данные.\n\n5. Заключительные положения\n5.1. Клиент подтверждает согласие с условиями при записи.\n\nРеквизиты: ${location}, адрес ${address}, телефон ${phone}.`.trim(),
    },
    {
      key: "cancellation-policy",
      title: "Правила отмены и переноса записи",
      description: "Правила отмены и переноса визита.",
      isRequired: false,
      sortOrder: 4,
      content: `Правила отмены и переноса записи\n\n1. Отмена и перенос возможны не позднее установленного окна (см. настройки).\n2. При отмене после установленного срока депозит может не возвращаться.\n3. Перенос возможен при наличии свободных слотов.\n4. При многократной неявке ${operator} может ограничить онлайн-запись.`.trim(),
    },
  ];
};

async function main() {
  const slug = process.argv[2] || "beauty-salon";
  const account = await prisma.account.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      locations: {
        select: { name: true, address: true, phone: true, websiteUrl: true },
        orderBy: { id: "asc" },
        take: 1,
      },
    },
  });

  if (!account) {
    throw new Error(`Account with slug "${slug}" not found`);
  }

  const docIds = await prisma.legalDocument.findMany({
    where: { accountId: account.id },
    select: { id: true },
  });
  const documentIds = docIds.map((doc) => doc.id);

  if (documentIds.length > 0) {
    const versionIds = await prisma.legalDocumentVersion.findMany({
      where: { documentId: { in: documentIds } },
      select: { id: true },
    });
    const versionIdList = versionIds.map((v) => v.id);

    if (versionIdList.length > 0) {
      await prisma.legalAcceptance.deleteMany({
        where: { documentVersionId: { in: versionIdList } },
      });
      await prisma.legalDocumentVersion.deleteMany({
        where: { id: { in: versionIdList } },
      });
    }

    await prisma.legalDocument.deleteMany({
      where: { id: { in: documentIds } },
    });
  }

  const location = account.locations[0];
  const docs = buildDefaultDocs({
    operatorName: account.name,
    locationName: location?.name,
    address: location?.address ?? undefined,
    phone: location?.phone ?? undefined,
    website: location?.websiteUrl ?? undefined,
  });

  for (const doc of docs) {
    const record = await prisma.legalDocument.create({
      data: {
        accountId: account.id,
        key: doc.key,
        title: doc.title,
        description: doc.description,
        isRequired: doc.isRequired,
        sortOrder: doc.sortOrder,
      },
    });

    await prisma.legalDocumentVersion.create({
      data: {
        documentId: record.id,
        version: 1,
        content: doc.content,
        isActive: true,
      },
    });
  }

  console.log(`Legal documents reseeded for ${slug}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
