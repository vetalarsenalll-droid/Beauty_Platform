export default function ClientHome() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Личный кабинет клиента
      </h1>
      <p className="text-[color:var(--bp-muted)]">
        Записи, оплаты, избранное, лояльность и настройки уведомлений.
      </p>
    </main>
  );
}
