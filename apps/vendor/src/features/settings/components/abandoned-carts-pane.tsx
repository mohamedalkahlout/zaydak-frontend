"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useMutation, useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Switch } from "@repo/ui/components/switch"
import {
  GET_ABANDONED_CHECKOUT_SETTING,
  UPSERT_ABANDONED_CHECKOUT_SETTING,
} from "@/features/abandoned-carts/api"
import type { AbandonedCheckoutSettingResponse } from "@/features/abandoned-carts/types"
import { AbandonedCartsCadenceEditor } from "@/features/abandoned-carts/components/abandoned-carts-cadence-editor"
import {
  draftsFromSteps,
  stepsFromDrafts,
  type CadenceStepDraft,
} from "@/features/abandoned-carts/lib/cadence"
import { parseCadence } from "@/features/abandoned-carts/lib/status"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import { SettingsCard } from "./settings-card"
import { useSettingsShop } from "./settings-shell"
import { parseSettingsPath } from "../lib/routes"

/**
 * Settings → Abandoned cart reminders: the shop's existing
 * `abandoned_checkout` cadence, not a second scheduler.
 *
 * Stages the enable switch and the step list locally, then commits through
 * the contextual save bar. Steps are clamped (count, floor, spacing, ceiling)
 * before they leave this screen, and again on upsert — a raw list is a mail
 * bomb.
 */
export function AbandonedCartsPane() {
  const shop = useSettingsShop()
  const t = useTranslations("settings")
  const tPane = useTranslations("settings.abandonedCarts")
  const { data } = useSuspenseQuery<AbandonedCheckoutSettingResponse>(
    GET_ABANDONED_CHECKOUT_SETTING,
  )
  const parsed = parseCadence(data?.setting?.data?.value ?? null)
  const seedKey = `${parsed.enabled}:${parsed.steps.join(",")}`

  const [enabled, setEnabled] = useState(parsed.enabled)
  const [drafts, setDrafts] = useState<CadenceStepDraft[]>(() =>
    draftsFromSteps(parsed.steps),
  )
  const [seededFrom, setSeededFrom] = useState<string | null>(null)

  if (seededFrom !== seedKey) {
    setSeededFrom(seedKey)
    setEnabled(parsed.enabled)
    setDrafts(draftsFromSteps(parsed.steps))
  }

  const steps = stepsFromDrafts(drafts)
  const dirty =
    enabled !== parsed.enabled || steps.join(",") !== parsed.steps.join(",")
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  const [upsert, { loading: saving }] = useMutation(
    UPSERT_ABANDONED_CHECKOUT_SETTING,
    {
      onCompleted: () => {
        sileo.success({ title: tPane("saved") })
      },
      onError: (err) => {
        sileo.error({ title: err.message || tPane("saveFailed") })
        setBarError(err.message || tPane("saveFailed"))
      },
    },
  )

  const onSave = () => {
    setBarError(null)
    void upsert({
      variables: {
        input: {
          key: "abandoned_checkout",
          value: { enabled, steps },
        },
      },
      refetchQueries: [GET_ABANDONED_CHECKOUT_SETTING],
    })
  }

  const onDiscard = () => {
    setEnabled(parsed.enabled)
    setDrafts(draftsFromSteps(parsed.steps))
    setBarError(null)
  }

  useEffect(() => {
    if (!dirty) {
      hideBar()
      return
    }
    showBar({ label: t("unsavedChanges"), saving, onSave, onDiscard })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, enabled, steps.join(",")])
  useEffect(() => () => hideBar(), [hideBar])

  useLeaveGuard({
    when: dirty,
    allow: (path) => parseSettingsPath(path).section === "abandonedCarts",
    onLeave: () => {
      setEnabled(parsed.enabled)
      setDrafts(draftsFromSteps(parsed.steps))
      setBarError(null)
      hideBar()
    },
  })

  const listHref = shop ? `/store/${shop.slug}/marketing/carts` : null

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard
        title={tPane("title")}
        description={tPane("description")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <label
              htmlFor="abandoned-cart-reminders-enabled"
              className="text-sm font-medium"
            >
              {tPane("enabled")}
            </label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {tPane("enabledHint")}
            </p>
          </div>
          <Switch
            id="abandoned-cart-reminders-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </SettingsCard>
      <SettingsCard title={tPane("stepsLabel")} description={tPane("stepsHint")}>
        <AbandonedCartsCadenceEditor drafts={drafts} onChange={setDrafts} />
      </SettingsCard>
      {listHref ? (
        <p className="text-sm text-muted-foreground">
          {tPane("listHint")}{" "}
          <Link
            href={listHref}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {tPane("listLink")}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
