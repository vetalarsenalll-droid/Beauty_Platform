const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const RESOURCE_LABELS = {
  locations: "Локации",
  services: "Услуги",
  "service-categories": "Категории услуг",
  specialists: "Специалисты",
  "specialist-levels": "Уровни специалистов",
  schedule: "График",
  calendar: "Журнал записи",
  appointments: "Записи",
  clients: "Клиенты",
  payments: "Оплаты",
  promos: "Промо",
  loyalty: "Лояльность",
  analytics: "Аналитика",
  settings: "Настройки",
};

const ACTION_LABELS = {
  read: "Просмотр",
  create: "Создание",
  update: "Редактирование",
  delete: "Удаление",
  confirm: "Подтверждение",
  cancel: "Отмена",
  reschedule: "Перенос",
  refund: "Возврат",
  export: "Экспорт",
};

function buildDescription(key) {
  if (key === "crm.all") return "Полный доступ к CRM";

  const parts = key.split(".");
  if (parts.length < 3) return null;

  const resource = RESOURCE_LABELS[parts[1]];
  const action = ACTION_LABELS[parts[2]];
  if (!resource || !action) return null;

  return `${resource}: ${action}`;
}

async function main() {
  const permissions = await prisma.permission.findMany({
    orderBy: { key: "asc" },
  });

  let updatedCount = 0;

  for (const permission of permissions) {
    const nextDescription = buildDescription(permission.key);
    if (!nextDescription) continue;
    if (permission.description === nextDescription) continue;

    await prisma.permission.update({
      where: { id: permission.id },
      data: { description: nextDescription },
    });
    updatedCount += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`Updated ${updatedCount} permission descriptions.`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
