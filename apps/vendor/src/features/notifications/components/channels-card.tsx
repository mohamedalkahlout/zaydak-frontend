"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { SendIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Switch } from "@repo/ui/components/switch"
import { UPDATE_NOTIFICATION_SETTING } from "../api"
import type { NotificationSettingEntry, UpdateSettingResult } from "../types"

/**
 * Which transports a shop's order notifications leave on.
 *
 * **On the landing screen rather than inside "customize templates".** These
 * answer "where do notifications go", which is a sibling of "who do they come
 * from" — the sender card directly above. The SMS switch used to live in the
 * branding card, three clicks deep in a sub-view about how an email *looks*,
 * where a merchant looking for it would never think to open.
 *
 * **Email is deliberately not a switch here.** It is not a channel a merchant
 * opts into; it is what happens whenever a customer left an address, and
 * per-template control already exists in the catalog. Offering a master email
 * toggle would invite somebody to silence the one channel every customer has.
 *
 * Staged locally and saved on an explicit press, like every other settings
 * card in this app.
 */
export function ChannelsCard({
  setting,
  onSaved,
}: {
  setting: NotificationSettingEntry
  onSaved: () => void
}) {
  const t = useTranslations("notifications")
  const [sms, setSms] = useState(setting.sms_enabled)
  const [whatsapp, setWhatsapp] = useState(setting.whatsapp_enabled)
  const [telegram, setTelegram] = useState(setting.telegram_enabled)
  const [update, { loading: saving }] = useMutation<UpdateSettingResult>(
    UPDATE_NOTIFICATION_SETTING,
  )

  const dirty =
    sms !== setting.sms_enabled ||
    whatsapp !== setting.whatsapp_enabled ||
    telegram !== setting.telegram_enabled

  async function save() {
    await update({
      variables: {
        input: {
          sms_enabled: sms,
          whatsapp_enabled: whatsapp,
          telegram_enabled: telegram,
        },
      },
    })
    onSaved()
  }

  const rows: {
    key: string
    title: string
    desc: string
    checked: boolean
    onChange: (v: boolean) => void
  }[] = [
    {
      key: "sms",
      title: t("console.smsTitle"),
      desc: t("console.smsDesc"),
      checked: sms,
      onChange: setSms,
    },
    {
      key: "whatsapp",
      title: t("console.channelsWhatsApp"),
      desc: t("console.channelsWhatsAppDesc"),
      checked: whatsapp,
      onChange: setWhatsapp,
    },
    {
      key: "telegram",
      title: t("console.channelsTelegram"),
      // Says out loud that switching this on is not enough on its own. A
      // merchant who turns it on and sees nothing arrive has hit Telegram's
      // rule, not a bug, and the description is the only place to say so
      // before they go looking.
      desc: t("console.channelsTelegramDesc"),
      checked: telegram,
      onChange: setTelegram,
    },
  ]

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <SendIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t("console.channelsTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("console.channelsDesc")}
          </p>

          <div className="mt-4 flex flex-col divide-y divide-border">
            {rows.map((row) => (
              <label
                key={row.key}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-sm">{row.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row.desc}
                  </span>
                </span>
                <Switch checked={row.checked} onCheckedChange={row.onChange} />
              </label>
            ))}
          </div>

          {dirty && (
            <div className="mt-4 flex justify-end">
              <Button onClick={save} disabled={saving} size="sm">
                {saving ? t("console.saving") : t("console.save")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
