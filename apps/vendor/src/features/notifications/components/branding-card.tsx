"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { PaletteIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Switch } from "@repo/ui/components/switch"
import { UPDATE_NOTIFICATION_SETTING } from "../api"
import type { NotificationSettingEntry, UpdateSettingResult } from "../types"

/**
 * The Shopify template "Branding" card: the logo, accent colour, and
 * "Powered by" footer applied across every notification email. Changes stage
 * locally and persist on an explicit Save (never on keystroke).
 *
 * **Branding only.** The SMS switch used to sit at the bottom of this card,
 * which put "where do notifications go" three clicks deep inside a sub-view
 * about how an email looks. It lives on `ChannelsCard` now, beside the other
 * transports and on the screen a merchant actually lands on.
 */
export function BrandingCard({
  setting,
  onSaved,
}: {
  setting: NotificationSettingEntry
  onSaved: () => void
}) {
  const t = useTranslations("notifications")
  const [logo, setLogo] = useState(setting.logo_url ?? "")
  const [logoWidth, setLogoWidth] = useState(setting.logo_width ?? 200)
  const [accent, setAccent] = useState(setting.accent_color ?? "#1a1a1a")
  const [poweredBy, setPoweredBy] = useState(setting.show_powered_by)
  const [update, { loading: saving }] = useMutation<UpdateSettingResult>(
    UPDATE_NOTIFICATION_SETTING,
  )

  const dirty =
    logo !== (setting.logo_url ?? "") ||
    logoWidth !== setting.logo_width ||
    accent !== setting.accent_color ||
    poweredBy !== setting.show_powered_by

  async function save() {
    await update({
      variables: {
        input: {
          logo_url: logo.trim() || null,
          logo_width: logoWidth,
          accent_color: accent,
          show_powered_by: poweredBy,
        },
      },
    })
    onSaved()
  }

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <PaletteIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t("console.brandingTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("console.brandingDesc")}
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("console.brandingLogo")}
              </span>
              {logo.trim() ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo}
                    alt={t("console.brandingLogo")}
                    style={{ maxWidth: logoWidth, maxHeight: 64 }}
                    className="h-auto object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setLogo("")}
                    className="ms-auto text-sm text-muted-foreground hover:text-destructive"
                  >
                    {t("console.brandingRemove")}
                  </button>
                </div>
              ) : (
                <Input
                  type="url"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="https://…/logo.png"
                />
              )}
              {logo.trim() && (
                <label className="mt-1 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {t("console.brandingLogoSize")}
                  </span>
                  <input
                    type="range"
                    min={40}
                    max={400}
                    step={4}
                    value={logoWidth}
                    onChange={(e) => setLogoWidth(Number(e.target.value))}
                    className="flex-1 accent-primary"
                    aria-label={t("console.brandingLogoSize")}
                  />
                  <span className="w-10 text-end text-xs tabular-nums text-muted-foreground">
                    {logoWidth}
                  </span>
                </label>
              )}
            </div>

            <label className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-muted-foreground">
                {t("console.brandingAccent")}
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  aria-label={t("console.brandingAccent")}
                  className="size-9 cursor-pointer rounded-md border border-border bg-transparent"
                />
                <Input
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="w-28 font-mono text-sm"
                />
              </span>
            </label>

            <label className="flex items-center justify-between gap-4">
              <span className="text-sm">{t("console.brandingPoweredBy")}</span>
              <Switch checked={poweredBy} onCheckedChange={setPoweredBy} />
            </label>
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
