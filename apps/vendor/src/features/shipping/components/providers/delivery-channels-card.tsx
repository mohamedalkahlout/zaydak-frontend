"use client"

import { useCallback, useEffect, useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { TriangleAlertIcon } from "lucide-react"

import { Input } from "@repo/ui/components/input"
import { Switch } from "@repo/ui/components/switch"

import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"

import { SettingsCard } from "@/features/settings/components/settings-card"
import {
  GET_SHOP_SHIPPING_SETTINGS,
  UPDATE_DELIVERY_CHANNELS,
} from "../../providers-api"
import type { ShopShippingSettings } from "../../providers-types"

/**
 * What the CUSTOMER is offered at checkout.
 *
 * The two switches are independent, and that is the whole point: a shop can
 * deliver its own orders, hand them to a shipping company, or offer both and
 * let the customer decide. Before this the shop had one exclusive mode and the
 * customer never saw which side it was on.
 *
 * **It replaced an exclusive mode card that contradicted it.** That card asked
 * *I deliver* OR *a carrier delivers*, directly above this one saying both
 * could be offered at once — a merchant reading the screen in order was told
 * the opposite thing twice. The exclusive framing described how a shipment is
 * EXECUTED, which stopped being a shop-wide setting the moment the customer's
 * pick started deciding it per order. `Shop.shipping_mode` survives on the
 * server as the fallback for orders frozen before that existed, and nothing on
 * this screen sets it any more.
 *
 * **Both off is allowed and is not guarded against.** A shop selling only
 * downloads offers no delivery at all — refusing that would be the UI
 * inventing a rule the business does not have. It is warned about, because it
 * is also what an accidental double-tap looks like.
 *
 * Staged locally and persisted through the **global contextual save bar**, like
 * every other editing surface in this app — flipping a switch must not dispatch
 * a mutation, or a merchant trying combinations rewrites their live checkout on
 * every tap. It carried its own Save button first, which worked but put a
 * second, competing save affordance on a screen whose other panes all use the
 * navbar one.
 *
 * The weight field is the one thing the bar cannot express: an invalid number
 * has to block the save, and the bar has no per-field validity. So a bad weight
 * keeps the bar hidden and says why inline, rather than offering a Save that
 * would be refused.
 */
export function DeliveryChannelsCard({
  settings,
  carrierReady = false,
  carrierAllowed = true,
  onCarrierStaged,
}: {
  settings?: ShopShippingSettings | null
  /**
   * Whether a carrier account is connected, enabled AND verified.
   *
   * Passed in rather than read off `settings.provider_ready`, which looks like
   * the same thing and is not: `provider_ready` is always `true` for a
   * merchant-managed shop, so the warning below would fire for every shop that
   * simply delivers its own orders. The section computes this from the accounts
   * themselves (`accountIsUsable`), which is independent of `shipping_mode`.
   */
  carrierReady?: boolean
  /** CountryProfile allows CARRIER. When false, the carrier switch is hidden. */
  carrierAllowed?: boolean
  /**
   * Reports the STAGED carrier switch, not the saved one.
   *
   * The section above uses it to decide whether to render the carrier cards —
   * and it has to be the staged value, because the account form is the next
   * thing a merchant needs after flipping this on. Gating that form on the
   * saved value hid it until they pressed Save, with nothing on screen saying
   * so: the switch read ON, the warning appeared, and the field they had been
   * told to fill in was simply absent.
   *
   * Called from the change handlers rather than an effect, so nothing sets
   * state during another component's render.
   */
  onCarrierStaged?: (on: boolean) => void
}) {
  const apollo = useApolloClient()
  const t = useTranslations("settings")
  const tc = useTranslations("settings.shipping.channels")
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  const serverMerchant = settings?.offers_merchant_delivery ?? true
  const serverCarrier = settings?.offers_carrier_delivery ?? false
  const serverWeight = settings?.default_item_weight_grams ?? 500

  // Seeded with adjust-state-during-render rather than an effect, so the
  // switches never paint one frame in the wrong position.
  const [seededFrom, setSeededFrom] = useState<typeof settings>(undefined)
  const [merchant, setMerchant] = useState(serverMerchant)
  const [carrier, setCarrier] = useState(serverCarrier)
  const [weight, setWeight] = useState(String(serverWeight))
  if (seededFrom !== settings) {
    setSeededFrom(settings)
    setMerchant(serverMerchant)
    setCarrier(serverCarrier)
    setWeight(String(serverWeight))
  }

  const parsedWeight = Number.parseInt(weight, 10)
  const weightValid = Number.isFinite(parsedWeight) && parsedWeight > 0

  const dirty =
    merchant !== serverMerchant ||
    carrier !== serverCarrier ||
    (weightValid && parsedWeight !== serverWeight)

  const [save, { loading: saving }] = useMutation(UPDATE_DELIVERY_CHANNELS, {
    onCompleted: () => {
      sileo.success({ title: tc("saved") })
      void apollo.refetchQueries({ include: [GET_SHOP_SHIPPING_SETTINGS] })
    },
    onError: (error: Error) => {
      sileo.error({ title: error.message })
      setBarError(error.message)
    },
  })

  const onSave = useCallback(() => {
    void save({
      variables: {
        input: {
          offers_merchant_delivery: merchant,
          offers_carrier_delivery: carrier,
          ...(weightValid ? { default_item_weight_grams: parsedWeight } : {}),
        },
      },
    })
  }, [save, merchant, carrier, weightValid, parsedWeight])

  const onDiscard = useCallback(() => {
    setMerchant(serverMerchant)
    setCarrier(serverCarrier)
    setWeight(String(serverWeight))
    onCarrierStaged?.(serverCarrier)
  }, [serverMerchant, serverCarrier, serverWeight, onCarrierStaged])

  // Drive the global navbar save bar while dirty; tear it down on unmount.
  //
  // An invalid weight deliberately keeps the bar HIDDEN rather than showing a
  // Save that would be refused: the bar has no notion of per-field validity, so
  // the only honest options are "no bar" or "a button that lies".
  const barReady = dirty && (!carrier || weightValid)
  useEffect(() => {
    if (!barReady) {
      hideBar()
      return
    }
    showBar({ label: t("unsavedChanges"), saving, onSave, onDiscard })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barReady, saving, onSave, onDiscard])
  useEffect(() => () => hideBar(), [hideBar])

  const carrierUnavailable = carrier && !settings?.provider_ready

  return (
    <SettingsCard title={tc("title")} description={tc("description")}>
      <div className="flex flex-col gap-4">
        <ChannelRow
          label={tc("merchantLabel")}
          hint={tc("merchantHint")}
          checked={merchant}
          onChange={setMerchant}
        />
        {carrierAllowed && (
          <ChannelRow
            label={tc("carrierLabel")}
            hint={tc("carrierHint")}
            checked={carrier}
            onChange={(next) => {
              setCarrier(next)
              onCarrierStaged?.(next)
            }}
          />
        )}

        {/*
          Turning both off is a real instruction, not a mistake to block — but
          it removes delivery from checkout entirely, so it is said before it
          is saved rather than discovered by a customer who cannot order.
        */}
        {!merchant && !(carrierAllowed && carrier) && (
          <Note tone="destructive">{tc("bothOff")}</Note>
        )}

        {/*
          A switch that promises something this SHOP cannot do yet — and the
          distinction is the whole message.

          This read "not connected on this platform yet … will apply once it
          is", which was true while one platform-owned carrier account served
          every shop. That reversed on 2026-08-31: each merchant connects their
          own account now, so the sentence told them to wait for something
          nobody was going to do, and named no action they could take. The fix
          is theirs to make, and it is one card down.

          Still not blocked: setting up in either order is legitimate, and the
          flag is honoured the moment the account is verified.
        */}
        {carrierUnavailable && (
          <Note tone="warning">{tc("carrierUnavailable")}</Note>
        )}

        {/*
          The mirror of the warning above, and the one that was missing.
          Everything is connected and working, and this switch is the only
          reason customers see nothing.

          This is not hypothetical. A shop reached production with a verified
          account, a warehouse registered at the carrier, stock in it and every
          carrier allowed — and no carrier prices at checkout, because this one
          flag was never saved. Every signal on the screen said the setup was
          finished. The merchant had no way to find out except from a customer.

          A warning, not an error: keeping the channel off while setting up, or
          pausing it deliberately, is a legitimate thing to do. It says what is
          true and what to press, and gets out of the way.
        */}
        {!carrier && carrierReady && (
          <Note tone="warning">{tc("carrierOff")}</Note>
        )}

        {carrier && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
            <label
              htmlFor="default-weight"
              className="text-sm font-medium"
            >
              {tc("weightLabel")}
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="default-weight"
                inputMode="numeric"
                value={weight}
                onChange={(e) =>
                  setWeight(e.target.value.replace(/[^\d]/g, ""))
                }
                className="w-32"
                aria-invalid={!weightValid}
              />
              <span className="text-sm text-muted-foreground">
                {tc("grams")}
              </span>
            </div>
            {/*
              The reason this field exists at all, stated where it is set:
              carriers price on weight, and most products have none.
            */}
            <p className="text-xs text-muted-foreground">{tc("weightHint")}</p>
            {!weightValid && (
              <p className="text-xs text-destructive">{tc("weightInvalid")}</p>
            )}
          </div>
        )}
      </div>
    </SettingsCard>
  )
}

function ChannelRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
    </label>
  )
}

function Note({
  tone,
  children,
}: {
  tone: "warning" | "destructive"
  children: React.ReactNode
}) {
  const styles =
    tone === "destructive"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
  return (
    <p
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${styles}`}
    >
      <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
