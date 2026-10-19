"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { MailIcon, CheckCircle2Icon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { SET_SENDER_EMAIL, RESEND_SENDER_VERIFICATION } from "../api"
import type { NotificationSettingEntry, SetSenderEmailResult } from "../types"

/**
 * The reply-to card: the address the store's emails carry as Reply-To,
 * and its verification state. Lets the vendor set/change it (which emails a
 * verification link) and resend the link.
 *
 * **It is never the From.** Every email leaves from the platform's address,
 * because a merchant's domain is not verified with the email provider, which
 * refuses it. Verifying proves the merchant receives mail there — that their
 * customers' answers will reach them — so any mailbox works, Gmail included,
 * and there is no public-domain warning any more.
 */
export function SenderEmailCard({
  setting,
  onChanged,
}: {
  setting: NotificationSettingEntry
  onChanged: () => void
}) {
  const t = useTranslations("notifications")
  const [email, setEmail] = useState(setting.sender_email ?? "")
  const [setSender, { loading: saving }] =
    useMutation<SetSenderEmailResult>(SET_SENDER_EMAIL)
  const [resend, { loading: resending }] = useMutation(
    RESEND_SENDER_VERIFICATION,
  )

  const current = setting.sender_email ?? null
  const dirty = email.trim() !== (current ?? "") && email.trim().length > 0

  async function save() {
    await setSender({ variables: { input: { email: email.trim() } } })
    onChanged()
  }

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <MailIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t("console.senderTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("console.senderDesc")}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="orders@yourstore.com"
              className="flex-1"
            />
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? t("console.saving") : t("console.senderSave")}
            </Button>
          </div>

          {current && !dirty && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              {setting.sender_verified ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4" />
                  {t("console.senderVerified")}
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    {t("console.senderUnverified")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void resend().then(onChanged)}
                    disabled={resending}
                    className="text-sm text-primary underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {t("console.senderResend")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
