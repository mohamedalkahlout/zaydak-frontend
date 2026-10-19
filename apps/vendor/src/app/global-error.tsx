"use client"

import { useEffect, useSyncExternalStore } from "react"
import { NextIntlClientProvider, useTranslations } from "next-intl"
import * as Sentry from "@sentry/nextjs"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_DIRECTIONS,
  resolveLocale,
} from "@/shared/i18n/config"
import { getCookie } from "@/shared/lib/cookies"
import enErrorPages from "@/shared/messages/en/errorPages.json"
import arErrorPages from "@/shared/messages/ar/errorPages.json"

/**
 * This boundary replaces the root layout, so the `NextIntlClientProvider`
 * that every other screen reads is gone with it. It brings its own, holding
 * only the `errorPages` namespace — the whole catalogue would be ~240KB in a
 * chunk that exists to say one sentence.
 *
 * The locale is the same cookie `i18n/request.ts` reads. It is read through
 * `useSyncExternalStore` with an English server snapshot, so a server-rendered
 * copy of this page cannot disagree with the client's first render.
 */
const ERROR_PAGES = { en: enErrorPages, ar: arErrorPages }

const subscribe = () => () => {}
const readLocale = () => resolveLocale(getCookie(LOCALE_COOKIE_NAME))
const serverLocale = () => DEFAULT_LOCALE

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const locale = useSyncExternalStore(subscribe, readLocale, serverLocale)

  useEffect(() => {
    // Report the render failure to Sentry (a no-op when no DSN is configured).
    Sentry.captureException(error)
    // eslint-disable-next-line no-console
    console.error("[global-error.tsx] caught render failure", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <html lang={locale} dir={LOCALE_DIRECTIONS[locale]}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1rem",
          background: "#fafafa",
          color: "#111",
        }}
      >
        <NextIntlClientProvider
          locale={locale}
          messages={{ errorPages: ERROR_PAGES[locale] }}
        >
          <GlobalErrorBody error={error} onRetry={() => unstable_retry()} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

function GlobalErrorBody({
  error,
  onRetry,
}: {
  error: Error & { digest?: string }
  onRetry: () => void
}) {
  const t = useTranslations("errorPages.boundary")

  return (
    <div style={{ maxWidth: 480, textAlign: "center" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>{t("title")}</h2>
      <p style={{ color: "#666", marginBottom: "1rem" }}>
        {error.message || t("unknown")}
      </p>
      {error.digest ? (
        <p style={{ color: "#999", fontSize: "0.75rem", marginBottom: "1rem" }}>
          {t("digest", { digest: error.digest })}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onRetry}
        style={{
          padding: "0.5rem 1rem",
          border: "1px solid #ccc",
          borderRadius: 6,
          background: "#fff",
          cursor: "pointer",
        }}
      >
        {t("tryAgain")}
      </button>
    </div>
  )
}
