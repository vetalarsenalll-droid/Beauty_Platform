// UTF-8 smoke test: русский текст в коде
export function formatBookingMessage(name: string, date: string, time: string): string {
  const greeting = `Здравствуйте, ${name}!`;
  const body = `Вы записаны на ${date} в ${time}.`;
  const note = "Если нужно, могу перенести запись на другое время.";

  // Проверка кириллицы в комментарии: ёжик, съёмка, мягкий знак
  return `${greeting} ${body} ${note}`;
}

if (require.main === module) {
  const result = formatBookingMessage("Надежда", "02.03.2026", "17:30");
  console.log(result);
}
