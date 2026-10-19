import type { Metadata } from "next";
import { Geist_Mono, Tajawal } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ApolloWrapper } from "@/shared/lib/apollo";
import { Toaster } from "@/shared/components/toaster";
import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config";
import { LocaleScope } from "@/shared/i18n/locale-scope";
import { bindRequestLocale } from "@/shared/i18n/request-locale";
import { ZodLocale } from "@/shared/i18n/zod-locale";
import { Agentation } from "agentation";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Tajawal — the platform's one Arabic face.
 *
 * The storefront picked it first and the consoles kept their own, which meant
 * a vendor read their own shop in one typeface and the dashboard that manages
 * it in another. One face across all three is the decision now, and the same
 * declaration is copied verbatim into each app rather than re-tuned.
 *
 * next/font downloads and self-hosts the woff2 at build time, so there is no
 * request to Google at runtime and nothing to copy into public/. Weights are
 * the ones the UI actually paints (light / regular / medium / bold); Tajawal
 * has no 600, and CSS font matching resolves `font-semibold` up to the real
 * bold rather than synthesising one.
 *
 * Bound as a CSS variable and applied only under `html[lang="ar"]` (see
 * globals.css), so locale switching stays the existing next-intl cookie path
 * and Latin keeps the SF stack.
 */
const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `getLocale` resolves via the cookie (see `i18n/request.ts`); we
  // also pre-load the message catalog here so the provider can hydrate
  // both server- and client-rendered components off the same payload.
  const locale = resolveLocale(await getLocale());
  bindRequestLocale(locale);
  const messages = await getMessages();
  const direction = LOCALE_DIRECTIONS[locale];

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${geistMono.variable} ${tajawal.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* `data-dashboard-texture`: a full-page storefront preview hides it (theme-preview) */}
        <div
          aria-hidden
          data-dashboard-texture
          className="select-none repeat-infinite invert dark:invert-0 z-9999 fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: "url(/bg.svg)",
            backgroundSize: "400px",
            opacity: 0.05,
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LocaleScope>
            <ZodLocale />
            <ApolloWrapper>{children}</ApolloWrapper>
            <Toaster />
          </LocaleScope>
        </NextIntlClientProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
