"use client"

import { useState } from "react"
import { gql } from "@apollo/client"
import { useMutation } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { useCartSessionStore } from "@/shared/stores/cart-session"
import Link from "next/link"

const IMPORT_SHEIN = gql`
  mutation ImportSheinShareLink($url: String!, $session_id: String, $lang: String) {
    importSheinShareLink(url: $url, session_id: $session_id, lang: $lang)
  }
`

export function SheinLinkDrop({
  base,
  embedded = false,
}: {
  base: string
  embedded?: boolean
}) {
  const t = useTranslations("home")
  const locale = useLocale()
  const sessionId = useCartSessionStore((s) => s.sessionId)
  const adopt = useCartSessionStore((s) => s.adopt)
  const [url, setUrl] = useState("")
  const [message, setMessage] = useState("")
  const [importLink, state] = useMutation<{ importSheinShareLink: string }>(IMPORT_SHEIN)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const id = sessionId ?? adopt()
    try {
      const { data } = await importLink({
        variables: { url, session_id: id, lang: locale === "ar" ? "ar" : "en" },
      })
      const text = data?.importSheinShareLink?.trim()
      setMessage(text || t("sheinFailed"))
    } catch {
      setMessage(t("sheinFailed"))
    }
  }

  return (
    <section className={embedded ? "mx-auto max-w-xl px-4 py-8" : "mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center px-4 py-16"}>
      <h1 className="text-2xl font-semibold">{t("sheinTitle")}</h1>
      <p className="mt-2 text-sm text-neutral-600">{t("sheinHint")}</p>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-6 flex flex-col gap-3">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("sheinPlaceholder")}
          className="h-11 rounded-md border border-neutral-300 px-3"
          required
        />
        <button
          type="submit"
          disabled={state.loading}
          className="h-11 rounded-md bg-neutral-900 text-white"
        >
          {t("sheinSubmit")}
        </button>
      </form>
      {message && <p className="mt-4 whitespace-pre-wrap text-sm">{message}</p>}
      <Link href={`${base}/checkout`} className="mt-4 text-sm underline">
        {t("sheinCheckout")}
      </Link>
    </section>
  )
}
