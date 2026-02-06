const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const docs = [
  {
    key: "platform-privacy",
    title: "Политика обработки персональных данных платформы",
    description: "Как платформа обрабатывает и защищает персональные данные.",
    isRequired: false,
    sortOrder: 1,
    content: `Политика обработки персональных данных платформы\n\n1. Общие положения\n1.1. Платформа является обработчиком персональных данных, действующим по поручению организаций, размещенных на платформе.\n1.2. Настоящая Политика описывает меры и порядок обработки данных платформой.\n\n2. Состав данных\n2.1. Контактные данные клиента, сведения о записи, технические данные (IP, user-agent).\n\n3. Цели обработки\n3.1. Обеспечение работы онлайн-записи.\n3.2. Хранение и передача данных организации-исполнителю.\n3.3. Улучшение качества сервиса.\n\n4. Безопасность\n4.1. Платформа применяет технические и организационные меры защиты.\n\n5. Контакты\n5.1. По вопросам обработки данных: support@platform.local.`.trim(),
  },
  {
    key: "platform-terms",
    title: "Пользовательское соглашение платформы",
    description: "Условия использования платформы онлайн-записи.",
    isRequired: false,
    sortOrder: 2,
    content: `Пользовательское соглашение платформы\n\n1. Платформа предоставляет техническую возможность онлайн-записи.\n2. Ответственность за оказание услуг несет организация, к которой клиент записывается.\n3. Платформа не является исполнителем услуг и не отвечает за качество услуг.\n4. Используя платформу, пользователь соглашается с условиями настоящего соглашения.`.trim(),
  },
];

async function main() {
  for (const doc of docs) {
    const record = await prisma.platformLegalDocument.upsert({
      where: { key: doc.key },
      create: {
        key: doc.key,
        title: doc.title,
        description: doc.description,
        isRequired: doc.isRequired,
        sortOrder: doc.sortOrder,
      },
      update: {
        title: doc.title,
        description: doc.description,
        isRequired: doc.isRequired,
        sortOrder: doc.sortOrder,
      },
    });

    const lastVersion = await prisma.platformLegalDocumentVersion.findFirst({
      where: { documentId: record.id },
      orderBy: { version: "desc" },
    });

    if (lastVersion && lastVersion.content === doc.content) {
      continue;
    }

    await prisma.platformLegalDocumentVersion.updateMany({
      where: { documentId: record.id, isActive: true },
      data: { isActive: false },
    });

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    await prisma.platformLegalDocumentVersion.create({
      data: {
        documentId: record.id,
        version: nextVersion,
        content: doc.content,
        isActive: true,
      },
    });
  }

  console.log("Platform legal documents seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
