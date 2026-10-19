"use client"

import { useCallback, useEffect, useState } from "react"
import { useApolloClient, useMutation, useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Switch } from "@repo/ui/components/switch"

import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { SettingsCard } from "@/features/settings/components/settings-card"
import {
  GET_SHOP_SHIPPING_CARRIERS,
  RESET_SHOP_SHIPPING_CARRIERS,
  SET_SHOP_SHIPPING_CARRIERS,
} from "../../providers-api"
import type { ShopCarrier, ShopCarriersResponse } from "../../providers-types"

/**
 * Which carriers this store offers.
 *
 * The credential belongs to the platform; this is the merchant's half of the
 * decision — and the only half they have. There is deliberately no token, no
 * verify and no sandbox switch on this screen any more: those are زيداك's,
 * managed once in the admin console.
 *
 * **"No stored choices" means every carrier is allowed, not none.** So while
 * `using_platform_defaults` is true every switch renders ON, and the card says
 * as much in a line above them. The opposite rendering — an empty grid the
 * merchant must fill in — would tell a shop that can ship with everything that
 * it can ship with nothing.
 *
 * Staged locally and persisted through the **global contextual save bar**, like
 * every other editing surface in this app: flipping a switch must not dispatch
 * a mutation, or a merchant experimenting with combinations rewrites their live
 * shipping on every click. It carried its own Save button first — the comment
 * here even claimed the bar — which put a second, competing save affordance on
 * a screen whose other panes all use the navbar one.
 *
 * **Reset stays a button, and that is not an inconsistency.** It is not the
 * inverse of Save: it DELETES the stored selection so the shop falls back to
 * "every carrier allowed", which is a different instruction from discarding an
 * edit and one the bar has no vocabulary for.
 */
export function CarrierSelectionCard() {
  const t = useTranslations("settings.shipping.carrier")
  const tSettings = useTranslations("settings")
  const apollo = useApolloClient()
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  const { data } = useSuspenseQuery<ShopCarriersResponse>(
    GET_SHOP_SHIPPING_CARRIERS,
    { fetchPolicy: "cache-and-network" },
  )
  const response = data?.shopShippingCarriers
  const offered = response?.data ?? []
  const usingDefaults = response?.using_platform_defaults ?? true

  /**
   * The staged set. Seeded from the server with **adjust-state-during-render**
   * rather than an effect, so the switches never paint one frame in the wrong
   * position before the server's answer lands.
   */
  const [seededFrom, setSeededFrom] = useState<ShopCarrier[] | null>(null)
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  if (seededFrom !== offered) {
    setSeededFrom(offered)
    setDraft(Object.fromEntries(offered.map((c) => [c.code, c.enabled])))
  }

  const dirty = offered.some((c) => (draft[c.code] ?? true) !== c.enabled)

  const done = () => {
    void apollo.refetchQueries({ include: [GET_SHOP_SHIPPING_CARRIERS] })
  }
  const onError = (error: Error) => {
    sileo.error({ title: error.message })
    setBarError(error.message)
  }

  const [save, saveState] = useMutation(SET_SHOP_SHIPPING_CARRIERS, {
    onCompleted: () => {
      sileo.success({ title: t("carriersSaved") })
      done()
    },
    onError,
  })
  const [reset, resetState] = useMutation(RESET_SHOP_SHIPPING_CARRIERS, {
    onCompleted: () => {
      sileo.success({ title: t("carriersReset") })
      done()
    },
    onError,
  })

  const onSave = useCallback(() => {
    void save({
      variables: {
        input: {
          carriers: offered.map((c) => ({
            code: c.code,
            name: c.name,
            enabled: draft[c.code] ?? true,
          })),
        },
      },
    })
  }, [save, offered, draft])

  const onDiscard = useCallback(() => {
    setDraft(Object.fromEntries(offered.map((c) => [c.code, c.enabled])))
  }, [offered])

  const saving = saveState.loading || resetState.loading

  // Drive the global navbar save bar while dirty; tear it down on unmount.
  useEffect(() => {
    if (!dirty) {
      hideBar()
      return
    }
    showBar({ label: tSettings("unsavedChanges"), saving, onSave, onDiscard })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, onSave, onDiscard])
  useEffect(() => () => hideBar(), [hideBar])
  const enabledCount = offered.filter((c) => draft[c.code] ?? true).length

  // Nothing to choose from: the platform has no carrier connected, or its
  // account holds no contracts. Either way this is not the merchant's to fix,
  // so the card says so instead of showing an empty list.
  if (offered.length === 0) {
    return (
      <SettingsCard
        title={t("carriersTitle")}
        description={t("carriersDescription")}
      >
        <p className="text-sm text-muted-foreground">{t("noCarriersHint")}</p>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard
      title={t("carriersTitle")}
      description={t("carriersDescription")}
    >
      <div className="flex flex-col gap-4">
        {usingDefaults && (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {t("usingPlatformDefaults")}
          </p>
        )}

        <ul className="flex flex-col divide-y divide-border">
          {offered.map((carrier) => {
            const on = draft[carrier.code] ?? true
            return (
              <li
                key={carrier.code}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/*
                    The logo is the aggregator's own asset, so it is a remote
                    URL rather than something we bundle — a plain `img`, not
                    `next/image`, because the host set is the carrier
                    network's and changes without a deploy.

                    It degrades in both directions: no `logo` renders the
                    reserved box empty rather than collapsing the row, and a
                    URL that 404s hides the image instead of leaving a broken
                    icon. The name beside it is what actually identifies the
                    carrier; the logo only makes it faster to find.
                  */}
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                    {carrier.logo ? (
                      <img
                        src={carrier.logo}
                        alt=""
                        loading="lazy"
                        className="size-full object-contain p-1"
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                        }}
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {carrier.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {carrier.code}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={on}
                  onCheckedChange={(next) =>
                    setDraft((prev) => ({ ...prev, [carrier.code]: next }))
                  }
                  aria-label={carrier.name}
                />
              </li>
            )
          })}
        </ul>

        {/*
          Turning everything off is a real instruction, not a mistake to
          block — but it stops carrier shipping for this shop entirely, so it
          is said plainly before it is saved rather than discovered when an
          order refuses to book.
        */}
        {enabledCount === 0 && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {t("allCarriersOffWarning")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/*
            Not the inverse of Save — it deletes the stored selection so the
            shop falls back to "every carrier allowed". The save bar has no
            vocabulary for that, so it stays a button.
          */}
          {!usingDefaults && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => void reset()}
            >
              {t("resetToDefaults")}
            </Button>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
