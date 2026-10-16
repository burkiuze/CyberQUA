import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import { enUS, trTR } from "@clerk/localizations";
import { I18nProvider } from "@/components/i18n-provider";
import { getI18n, getTheme } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-jetbrains", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: dict.meta.title, template: "%s · CyberQUA" },
    description: dict.meta.description,
    applicationName: "CyberQUA",
    openGraph: { title: dict.meta.title, description: dict.meta.description, type: "website", siteName: "CyberQUA" },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0e14" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, dict }, theme] = await Promise.all([getI18n(), getTheme()]);
  const accent = theme === "dark" ? "#2de2c4" : "#0b9c84";

  return (
    <html lang={locale} data-theme={theme} className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">
        <ClerkProvider
          localization={locale === "tr" ? trTR : enUS}
          afterSignOutUrl="/"
          appearance={{
            theme: theme === "dark" ? dark : undefined,
            variables: {
              colorPrimary: accent,
              colorBackground: theme === "dark" ? "#0e131b" : "#ffffff",
              borderRadius: "0px",
              fontFamily: "var(--font-inter)",
            },
          }}
        >
          <I18nProvider locale={locale} dict={dict}>
            {children}
          </I18nProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
