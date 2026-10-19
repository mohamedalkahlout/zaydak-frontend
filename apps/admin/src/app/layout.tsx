import type { Metadata } from "next";
import { Geist_Mono, Tajawal } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { ApolloProvider } from "@/shared/apollo/client";
import { Toaster } from "@/shared/components/toaster";
import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config";
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

export const metadata: Metadata = {
  title: "Zaydak — Admin console",
  description: "Platform administration for Zaydak.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `getLocale` resolves via the cookie (see `i18n/request.ts`); the message
  // catalog is pre-loaded here so server- and client-rendered components
  // hydrate off the same payload.
  const locale = resolveLocale(await getLocale());
  const messages = await getMessages();
  const direction = LOCALE_DIRECTIONS[locale];

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${geistMono.variable} ${tajawal.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ApolloProvider>{children}</ApolloProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
