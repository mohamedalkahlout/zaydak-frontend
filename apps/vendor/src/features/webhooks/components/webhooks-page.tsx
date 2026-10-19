"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  useSuspenseQuery,
  useMutation,
  useApolloClient,
} from "@apollo/client/react"
import { sileo } from "sileo"
import {
  Webhook,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  History,
  Send,
  CheckCircle2,
  PauseCircle,
} from "lucide-react"
import {
  GET_WEBHOOK_SUBSCRIPTIONS,
  DELETE_WEBHOOK_SUBSCRIPTION,
  ROTATE_WEBHOOK_SECRET,
  SEND_TEST_WEBHOOK,
} from "../api"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent } from "@repo/ui/components/card"
import { Badge } from "@repo/ui/components/badge"
import { WebhookFormDialog } from "./webhook-form-dialog"
import { WebhookDeliveriesDialog } from "./webhook-deliveries-dialog"
import { WebhookSecretDialog } from "./webhook-secret-dialog"

type Subscription = {
  id: string
  shop_id: string
  url: string
  events: string[]
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  secret?: string | null
}

type SubsResp = {
  webhookSubscriptions: { success: boolean; data: Subscription[] }
}

/** Only the field read below. Rotate is the one other place a secret is ever
 *  returned, and like create it is returned exactly once. */
type RotateResult = {
  rotateWebhookSecret?: { secret?: string | null } | null
}

/**
 * Vendor self-service webhook management. List view shows one card per
 * subscription with quick actions (edit / rotate / deliveries / delete).
 * Secrets are write-once: shown in a one-shot dialog right after create
 * or rotate, never re-fetched.
 */
export function WebhooksPage() {
  const t = useTranslations("webhooks")
  const client = useApolloClient()
  const { data } = useSuspenseQuery<SubsResp>(GET_WEBHOOK_SUBSCRIPTIONS)
  const subs = data?.webhookSubscriptions?.data ?? []

  const [editing, setEditing] = useState<Subscription | null>(null)
  const [creating, setCreating] = useState(false)
  const [showingDeliveries, setShowingDeliveries] = useState<Subscription | null>(null)
  const [revealedSecret, setRevealedSecret] = useState<{
    url: string
    secret: string
  } | null>(null)

  const [deleteSub, { loading: deleting }] = useMutation(
    DELETE_WEBHOOK_SUBSCRIPTION,
    {
      onCompleted: () => {
        sileo.success({ title: t("deleted") })
        void client.refetchQueries({ include: [GET_WEBHOOK_SUBSCRIPTIONS] })
      },
      onError: (err) =>
        sileo.error({ title: err.message || t("deleteFailed") }),
    },
  )

  const [rotateSecret, { loading: rotating }] = useMutation<RotateResult>(
    ROTATE_WEBHOOK_SECRET,
    {
      onCompleted: (resp) => {
        if (resp?.rotateWebhookSecret?.secret) {
          setRevealedSecret({
            url: t("unchangedUrl"),
            secret: resp.rotateWebhookSecret.secret,
          })
        }
      },
      onError: (err) =>
        sileo.error({ title: err.message || t("rotateFailed") }),
    },
  )

  const [sendTest, { loading: testing }] = useMutation(SEND_TEST_WEBHOOK, {
    onCompleted: () =>
      sileo.success({
        title: t("testSent"),
        description: t("testSentBody"),
      }),
    onError: (err) =>
      sileo.error({ title: err.message || t("testFailed") }),
  })

  function onDelete(sub: Subscription) {
    if (
      !window.confirm(
        t("deleteConfirm", { url: sub.url }),
      )
    )
      return
    void deleteSub({ variables: { id: sub.id } })
  }

  function onRotate(sub: Subscription) {
    if (
      !window.confirm(
        t("rotateConfirm", { url: sub.url }),
      )
    )
      return
    void rotateSecret({ variables: { id: sub.id } })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {subs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <Webhook className="size-8 text-muted-foreground/60" />
            <p>
              {t("empty")}
            </p>
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t("addFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {subs.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-1 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Webhook className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={sub.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-foreground hover:underline"
                      >
                        {sub.url}
                      </a>
                      {sub.is_active ? (
                        <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          {t("active")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <PauseCircle className="size-3" />
                          {t("paused")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {sub.events.map((e) => (
                        <span
                          key={e}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/70"
                        >
                          {t.has(`events.${e}`)
                            ? t(`events.${e}`)
                            : e.replace(/_/g, " ").toLowerCase()}
                        </span>
                      ))}
                    </div>
                    {sub.description && (
                      <p className="text-xs text-muted-foreground">
                        {sub.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void sendTest({ variables: { id: sub.id } })}
                    disabled={testing}
                  >
                    <Send className="size-4" />
                    {t("sendTest")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowingDeliveries(sub)}
                  >
                    <History className="size-4" />
                    {t("history")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRotate(sub)}
                    disabled={rotating}
                  >
                    <KeyRound className="size-4" />
                    {t("rotateSecret")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(sub)}
                  >
                    <Pencil className="size-4" />
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleting}
                    onClick={() => onDelete(sub)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WebhookFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        onCreated={(s) => {
          if (s?.secret) {
            setRevealedSecret({ url: s.url, secret: s.secret })
          }
        }}
      />
      {editing && (
        <WebhookFormDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          mode="edit"
          subscription={editing}
        />
      )}
      {showingDeliveries && (
        <WebhookDeliveriesDialog
          subscription={showingDeliveries}
          open={!!showingDeliveries}
          onOpenChange={(o) => !o && setShowingDeliveries(null)}
        />
      )}
      {revealedSecret && (
        <WebhookSecretDialog
          url={revealedSecret.url}
          secret={revealedSecret.secret}
          onClose={() => setRevealedSecret(null)}
        />
      )}
    </div>
  )
}

// Re-export type so the form dialog can share the shape without importing
// from this file directly (avoids client-component circularity).
export type { Subscription as WebhookSubscriptionShape }
