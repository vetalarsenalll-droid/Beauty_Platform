import type { Metadata } from "next";
import { Manrope, Montserrat } from "next/font/google";
import { APP_BRAND_NAME } from "@/lib/brand";
import "./globals.css";

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const montserrat = Montserrat({
  subsets: ["cyrillic", "latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: APP_BRAND_NAME,
  description: "Маркетплейс и личный кабинет клиента",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${montserrat.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
