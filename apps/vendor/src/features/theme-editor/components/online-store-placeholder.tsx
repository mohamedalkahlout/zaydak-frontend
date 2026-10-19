"use client"

import { useTranslations } from "next-intl"

export function OnlineStorePlaceholder({
  kind,
}: {
  kind: "navigation" | "preferences"
}) {
  const t = useTranslations("themeEditor")
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-2 rounded-xl bg-card px-8 py-12 text-center shadow-sm ring-1 ring-foreground/10">
      <h1 className="text-xl font-semibold tracking-tight">
        {t(`placeholders.${kind}Title`)}
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t(`placeholders.${kind}Body`)}
      </p>
    </div>
  )
}
