import type { Metadata } from "next";
import { Geist_Mono, Tajawal } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { ApolloProvider } from "@/shared/apollo/client";
import { Toaster } from "@/shared/components/toaster";
import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config";
import { HOST_SHOP_ATTRIBUTE } from "@/shared/lib/tenant";
import { requestOrigin, serverHostShop } from "@/shared/lib/tenant-server";
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

/**
 * `metadataBase` resolves every relative URL the metadata layer emits, and it
 * cannot be a constant any more.
 *
 * `SITE_URL` comes from a `NEXT_PUBLIC_` variable, so it is inlined at build
 * time and is the same string for every request — which was correct while one
 * origin served every shop, and is wrong now that `acme.zaydak.com` serves
 * Acme. A relative OG image resolved against the apex on a page served from the
 * shop's own domain points at an origin the visitor is not on.
 *
 * `requestOrigin()` reads the host the proxy resolved and falls back to
 * `SITE_URL` for the apex and for any request that never passed through the
 * proxy, so nothing changes for the addresses that existed before.
 *
 * Title and description stay locale-aware (`Zaydak` / `زايدك`) via next-intl;
 * they are not a hardcoded English string.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(await getLocale());
  const t = await getTranslations({ locale, namespace: "common" });
  const name = t("appName");

  return {
    metadataBase: new URL(await requestOrigin()),
    title: name,
    description: t("metaDescription"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `getLocale` resolves via the cookie (see `i18n/request.ts`); the message
  // catalog is pre-loaded here so server- and client-rendered components
  // hydrate off the same payload.
  const locale = resolveLocale(await getLocale());
  const messages = await getMessages();
  const direction = LOCALE_DIRECTIONS[locale];

  // The shop the proxy resolved this document's hostname to, handed to the
  // browser on `<html>` so it is there before any client query goes out. It is
  // the only way the browser can scope a request on a merchant's own domain,
  // whose hostname names no shop — see `HOST_SHOP_ATTRIBUTE`. Absent in path
  // mode, where the path already says.
  const hostShop = await serverHostShop();

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${geistMono.variable} ${tajawal.variable} h-full font-sans antialiased`}
      {...(hostShop ? { [HOST_SHOP_ATTRIBUTE]: hostShop } : {})}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ApolloProvider>{children}</ApolloProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
