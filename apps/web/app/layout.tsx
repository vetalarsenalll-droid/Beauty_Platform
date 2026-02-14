import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty Platform",
  description: "Маркетплейс и личный кабинет клиента",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
