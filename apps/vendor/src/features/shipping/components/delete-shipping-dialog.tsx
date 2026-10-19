"use client"

import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"

import {
  DELETE_SHIPPING_RULE,
  DELETE_SHIPPING_ZONE,
  GET_SHIPPING_RULES,
  GET_SHIPPING_ZONES,
} from "../api"

/**
 * Confirms deleting a zone or a rate.
 *
 * The two share a dialog because the consequence is the same sentence with a
 * different noun, and because deleting a zone is the more dangerous of the two:
 * its rates go with it, and if it was the catch-all every destination outside
 * the remaining zones stops being quotable. The copy says so rather than
 * asking a generic "are you sure".
 *
 * It refuses the last rate on a zone. A zone with no rate is not "free", it is
 * a wall: the matcher returns it with no options, checkout answers
 * `destination_excluded`, and `createOrder` refuses every order to its
 * destinations. The refusal is a dialog rather than a disabled trash icon
 * because a dead button with no explanation is what sends a merchant to
 * support, and a tooltip is unreachable on touch — this one names the two
 * ways out, and one of them is a click away.
 */
export function DeleteShippingDialog({
  open,
  kind,
  id,
  name,
  lastRateOfZone,
  onDeleteZoneInstead,
  onOpenChange,
}: {
  open: boolean
  kind: "zone" | "rate"
  id: string
  name: string
  /**
   * The zone this rate is the last one on, when it is. Only meaningful for
   * `kind === "rate"`; an unzoned rate never sets it, because removing the
   * last flat rate leaves the shop `not_configured`, which checkout lets
   * through with a warning rather than refusing.
   */
  lastRateOfZone?: { name: string } | null
  /** Swaps this dialog for the zone confirmation — the other way out. */
  onDeleteZoneInstead?: () => void
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings.shipping")
  const tCommon = useTranslations("common")
  const apollo = useApolloClient()

  const done = () => {
    void apollo.refetchQueries({
      include: [GET_SHIPPING_ZONES, GET_SHIPPING_RULES],
    })
    onOpenChange(false)
  }
  const onError = (error: Error) => sileo.error({ title: error.message })

  const [deleteZone, zoneState] = useMutation(DELETE_SHIPPING_ZONE, {
    onCompleted: () => {
      sileo.success({ title: t("zoneDeleted") })
      done()
    },
    onError,
  })
  const [deleteRule, ruleState] = useMutation(DELETE_SHIPPING_RULE, {
    onCompleted: () => {
      sileo.success({ title: t("rateDeleted") })
      done()
    },
    onError,
  })

  const pending = zoneState.loading || ruleState.loading

  // Advisory, not enforced: the count comes from the zone list as last
  // fetched and the server has no last-rate rule of its own, so the copy says
  // what happens rather than promising the server would have refused.
  const blockedBy = kind === "rate" ? (lastRateOfZone ?? null) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {blockedBy
              ? t("deleteLastRateTitle")
              : kind === "zone"
                ? t("deleteZoneTitle")
                : t("deleteRateTitle")}
          </DialogTitle>
          <DialogDescription>
            {blockedBy
              ? t("deleteLastRateBody", { name, zone: blockedBy.name })
              : kind === "zone"
                ? t("deleteZoneBody", { name })
                : t("deleteRateBody", { name })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          {blockedBy ? (
            // No Delete here at all: `deleteRule` is unreachable while the
            // rate is the zone's last one, not merely disabled.
            onDeleteZoneInstead && (
              <Button variant="destructive" onClick={onDeleteZoneInstead}>
                {t("deleteZoneInstead")}
              </Button>
            )
          ) : (
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (kind === "zone") void deleteZone({ variables: { id } })
                else void deleteRule({ variables: { id } })
              }}
            >
              {tCommon("delete")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
