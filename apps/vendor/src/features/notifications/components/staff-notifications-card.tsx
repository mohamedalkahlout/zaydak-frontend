"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { UsersIcon, Trash2Icon, PlusIcon, SendIcon, CheckIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Switch } from "@repo/ui/components/switch"
import {
  STAFF_NOTIFICATION_RECIPIENTS,
  ADD_STAFF_RECIPIENT,
  UPDATE_STAFF_RECIPIENT,
  REMOVE_STAFF_RECIPIENT,
  SEND_TEST_STAFF_NOTIFICATION,
} from "../api"
import type { StaffRecipientsResult } from "../types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Shopify "Staff notifications" — who on the team gets emailed when a new order
 * comes in. A recipient list with add / remove / enable-toggle. Each action is
 * an immediate single mutation (a settings surface, not an edit-then-save form).
 */
export function StaffNotificationsCard() {
  const t = useTranslations("notifications")
  const [email, setEmail] = useState("")

  const { data, refetch } = useQuery<StaffRecipientsResult>(
    STAFF_NOTIFICATION_RECIPIENTS,
    { fetchPolicy: "cache-and-network" },
  )
  const [add, { loading: adding }] = useMutation(ADD_STAFF_RECIPIENT)
  const [update] = useMutation(UPDATE_STAFF_RECIPIENT)
  const [remove] = useMutation(REMOVE_STAFF_RECIPIENT)
  const [sendTest, { loading: testing }] = useMutation(
    SEND_TEST_STAFF_NOTIFICATION,
  )
  const [tested, setTested] = useState(false)

  const recipients = data?.staffNotificationRecipients.data ?? []
  const valid = EMAIL_RE.test(email.trim())

  async function onSendTest() {
    await sendTest()
    setTested(true)
    setTimeout(() => setTested(false), 3000)
  }

  async function onAdd() {
    if (!valid) return
    await add({ variables: { input: { email: email.trim(), events: [] } } })
    setEmail("")
    void refetch()
  }

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <UsersIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t("staff.title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("staff.desc")}
              </p>
            </div>
            {recipients.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSendTest}
                disabled={testing}
                className="shrink-0"
              >
                {tested ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <SendIcon className="size-4" />
                )}
                {tested ? t("staff.testSent") : t("staff.sendTest")}
              </Button>
            )}
          </div>

          {recipients.length > 0 && (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {recipients.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {r.email}
                  </span>
                  <Switch
                    checked={r.enabled}
                    aria-label={t("staff.toggle")}
                    onCheckedChange={(v) =>
                      void update({
                        variables: { input: { id: r.id, enabled: v } },
                      }).then(() => refetch())
                    }
                  />
                  <button
                    type="button"
                    aria-label={t("staff.remove")}
                    onClick={() =>
                      void remove({ variables: { id: r.id } }).then(() =>
                        refetch(),
                      )
                    }
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onAdd()
              }}
              placeholder={t("staff.emailPlaceholder")}
              className="flex-1"
            />
            <Button onClick={onAdd} disabled={!valid || adding}>
              <PlusIcon className="size-4" />
              {t("staff.add")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
