import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { dirOf, type Locale } from "@/i18n/locale";
import { PwaRegister } from "@/components/ui/PwaRegister";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});
const latin = Inter({ variable: "--font-latin", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("name"),
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: t("short"), statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6e62",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await getLocale()) as Locale;
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${arabic.variable} ${latin.variable}`}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <PwaRegister />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
