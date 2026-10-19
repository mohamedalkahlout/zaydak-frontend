"use client"

import { useTranslations } from "next-intl"

import { TelegramShopBotCard } from "./telegram-shop-bot-card"
import { TelegramVendorBotCard } from "./telegram-vendor-bot-card"

/**
 * Settings → Telegram.
 *
 * Two cards under two headings, and the headings are doing real work. The
 * first is the **shop's own bot**, which customers write *to*; the second is
 * **Zaydak's** bot, which the vendor writes to. The same discipline the
 * WhatsApp screen keeps between the shop's number and the platform's, in the
 * same order — the shop's first, because it is the one a merchant came here
 * to set up, and because a merchant who conflates the two hands a customer the
 * wrong bot.
 *
 * The two halves are also two scopes: the shop bot is shop-scoped through
 * `X-SHOP`, the assistant is account-scoped and reads no header at all.
 */
export function TelegramSection() {
  const t = useTranslations("settings.telegram")

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      {/* ── The shop's own bot ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">{t("group.shop.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("group.shop.description")}
          </p>
        </div>
        <TelegramShopBotCard />
      </section>

      {/* ── The platform's bot ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">{t("group.assistant.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("group.assistant.description")}
          </p>
        </div>
        <TelegramVendorBotCard />
      </section>
    </div>
  )
}
