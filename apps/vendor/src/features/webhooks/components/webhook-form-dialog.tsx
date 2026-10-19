"use client"

import { useState } from "react"
import { useMutation, useApolloClient } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import {
  CREATE_WEBHOOK_SUBSCRIPTION,
  UPDATE_WEBHOOK_SUBSCRIPTION,
  GET_WEBHOOK_SUBSCRIPTIONS,
} from "../api"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { Checkbox } from "@repo/ui/components/checkbox"
import { AppleSwitch } from "@repo/ui/components/apple-switch"

interface SubLike {
  id: string
  url: string
  events: string[]
  description?: string | null
  is_active: boolean
}

/** These documents use the plain `@apollo/client` `gql`, not the codegen tag,
 *  so the result carries no type of its own — only the fields read below are
 *  declared. `secret` is returned exactly once, on create. */
type CreateResult = {
  createWebhookSubscription?: {
    data?: { url?: string | null; secret?: string | null } | null
  } | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  subscription?: SubLike
  onCreated?: (s: { url: string; secret: string | null | undefined }) => void
}

// Keep in sync with `WebhookEventType` enum on the server. Hardcoded here
// (rather than fetched) because GraphQL enum introspection is overkill for
// a list of 7 items that rarely changes. Each one's words live under
// `webhooks.events.<value>`.
const ALL_EVENTS = [
  "INVENTORY_ADJUSTED",
  "ORDER_CREATED",
  "ORDER_PAID",
  "ORDER_CANCELLED",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_DELETED",
] as const

export function WebhookFormDialog({
  open,
  onOpenChange,
  mode,
  subscription,
  onCreated,
}: Props) {
  const t = useTranslations("webhooks")
  const tCommon = useTranslations("common")
  const client = useApolloClient()
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState<string[]>([])
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)

  // Seed the form each time the dialog opens, and re-seed if it is pointed at a
  // different row. Adjusted during render rather than from an effect: React
  // discards this render and re-runs immediately with the seeded values, where
  // an effect would first commit a frame showing the PREVIOUS row's values in
  // the inputs. Keyed on the same three values the dependency list carried.
  const [seededFrom, setSeededFrom] = useState<{
    open: boolean
    mode: typeof mode
    subscription: typeof subscription
  } | null>(null)

  if (
    !seededFrom ||
    seededFrom.open !== open ||
    seededFrom.mode !== mode ||
    seededFrom.subscription !== subscription
  ) {
    setSeededFrom({ open, mode, subscription })
    if (!open) {
      // nothing to seed while closed
    } else if (mode === "edit" && subscription) {
      setUrl(subscription.url)
      setEvents(subscription.events ?? [])
      setDescription(subscription.description ?? "")
      setIsActive(subscription.is_active)
    } else {
      setUrl("")
      setEvents([])
      setDescription("")
      setIsActive(true)
    }
  }

  const [createMutation, { loading: creating }] = useMutation<CreateResult>(
    CREATE_WEBHOOK_SUBSCRIPTION,
    {
      onCompleted: (resp) => {
        sileo.success({ title: t("form.created") })
        void client.refetchQueries({ include: [GET_WEBHOOK_SUBSCRIPTIONS] })
        const created = resp?.createWebhookSubscription?.data
        onCreated?.({ url: created?.url ?? url, secret: created?.secret })
        onOpenChange(false)
      },
      onError: (err) =>
        sileo.error({ title: err.message || t("form.createFailed") }),
    },
  )

  const [updateMutation, { loading: updating }] = useMutation(
    UPDATE_WEBHOOK_SUBSCRIPTION,
    {
      onCompleted: () => {
        sileo.success({ title: t("form.updated") })
        void client.refetchQueries({ include: [GET_WEBHOOK_SUBSCRIPTIONS] })
        onOpenChange(false)
      },
      onError: (err) =>
        sileo.error({ title: err.message || t("form.updateFailed") }),
    },
  )

  const busy = creating || updating

  function toggleEvent(value: string) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    )
  }

  function onSubmit() {
    if (!url.trim()) {
      sileo.error({ title: t("form.urlRequired") })
      return
    }
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      sileo.error({ title: t("form.urlScheme") })
      return
    }
    if (events.length === 0) {
      sileo.error({ title: t("form.eventsRequired") })
      return
    }

    if (mode === "create") {
      void createMutation({
        variables: {
          input: {
            url: url.trim(),
            events,
            description: description.trim() || null,
          },
        },
      })
    } else if (subscription) {
      void updateMutation({
        variables: {
          input: {
            id: subscription.id,
            url: url.trim(),
            events,
            description: description.trim() || null,
            is_active: isActive,
          },
        },
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("add") : t("form.editTitle")}
          </DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="wh-url">{t("form.url")}</FieldLabel>
            <Input
              id="wh-url"
              type="url"
              placeholder="https://api.example.com/webhooks/zaydak"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>{t("form.events")}</FieldLabel>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
              {ALL_EVENTS.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={events.includes(value)}
                    onCheckedChange={() => toggleEvent(value)}
                  />
                  <span className="flex-1">{t(`events.${value}`)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {value}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="wh-desc">{t("form.descriptionLabel")}</FieldLabel>
            <Textarea
              id="wh-desc"
              rows={2}
              placeholder={t("form.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          {mode === "edit" && (
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div>
                <div className="font-medium">{t("active")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("form.activeHint")}
                </div>
              </div>
              <AppleSwitch
                checked={isActive}
                onCheckedChange={(v) => setIsActive(!!v)}
              />
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={busy || !url.trim() || events.length === 0}
          >
            {busy
              ? t("form.saving")
              : mode === "create"
                ? t("form.create")
                : tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
