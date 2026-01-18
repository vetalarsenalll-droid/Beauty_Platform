export default function CrmHome() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">CRM Бизнес</h1>
      <p className="text-[color:var(--bp-muted)]">
        Операционка бизнеса: календарь, расписание, услуги, специалисты,
        клиенты, финансы, промо, лояльность, аналитика и настройки.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          "Календарь",
          "Расписание",
          "Услуги",
          "Специалисты",
          "Клиенты",
          "Оплаты",
          "Промо",
          "Лояльность",
          "Аналитика",
          "Настройки",
        ].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white/70 p-4 text-sm font-medium shadow-[var(--bp-shadow)]"
          >
            {item}
          </div>
        ))}
      </div>
    </main>
  );
}
