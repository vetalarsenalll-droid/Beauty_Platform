export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Beauty Platform
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Маркетплейс
          </h1>
          <p className="max-w-2xl text-lg text-[color:var(--bp-muted)]">
            Витрина для поиска, просмотра профилей и входа в запись.
          </p>
        </header>
        <section className="grid gap-4 sm:grid-cols-2">
          <a
            href="/c"
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 text-lg font-medium shadow-[var(--bp-shadow)] transition hover:bg-white"
          >
            Личный кабинет клиента (/c)
          </a>
          <a
            href="/booking"
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 text-lg font-medium shadow-[var(--bp-shadow)] transition hover:bg-white"
          >
            Онлайн-запись (/booking)
          </a>
        </section>
      </main>
    </div>
  );
}
