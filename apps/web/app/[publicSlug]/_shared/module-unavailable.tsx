import Link from "next/link";

type PublicModuleUnavailableProps = {
  title: string;
  message: string;
};

export function PublicModuleUnavailable({ title, message }: PublicModuleUnavailableProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-5 py-10 text-[#181512]">
      <section className="w-full max-w-xl rounded-[32px] border border-black/10 bg-white p-8 text-center shadow-[0_24px_80px_rgba(24,21,18,0.12)]">
        <p className="text-xs uppercase tracking-[0.22em] text-black/45">Онлайс</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-black/60">{message}</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
        >
          На главную
        </Link>
      </section>
    </main>
  );
}
