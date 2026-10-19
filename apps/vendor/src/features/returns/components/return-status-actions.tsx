"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { GET_RETURNS, UPDATE_RETURN_STATUS } from "@/features/returns/api"
import type {
  ReturnEntry,
  ReturnStatus,
  UpdateReturnStatusResponse,
} from "@/features/returns/types"
import {
  movesMoney,
  nextReturnStatuses,
  toReturnStatusInput,
} from "@/features/returns/lib/status"

/**
 * Advances one return through the RMA lifecycle.
 *
 * Only the transitions the back-end's state machine actually allows are
 * offered, so there is no button that fails with `invalid_transition`.
 *
 * `received` is singled out: that is where the back-end issues the refund (net
 * of the restocking fee) and puts the goods back into stock. It is the only
 * transition that moves money, so it is the only one behind a confirmation.
 */
export function ReturnStatusActions({ entry }: { entry: ReturnEntry }) {
  const t = useTranslations("returns")
  const tCommon = useTranslations("common")
  const [confirming, setConfirming] = useState<ReturnStatus | null>(null)

  const [updateStatus, { loading }] = useMutation<UpdateReturnStatusResponse>(
    UPDATE_RETURN_STATUS,
    {
      refetchQueries: [
        { query: GET_RETURNS, variables: { page: 1, limit: 50 } },
      ],
      awaitRefetchQueries: true,
    }
  )

  const targets = nextReturnStatuses(entry.status)
  if (targets.length === 0) return null

  function run(target: ReturnStatus) {
    void updateStatus({
      // The row's status reads back lowercase; the input enum is uppercase.
      variables: { input: { id: entry.id, status: toReturnStatusInput(target) } },
    })
      .then(() => {
        sileo.success({ title: t(`actions.${target}`) })
        setConfirming(null)
      })
      .catch((err: unknown) =>
        sileo.error({
          title: t("statusActions.failed"),
          description: err instanceof Error ? err.message : undefined,
        })
      )
  }

  function onSelect(target: ReturnStatus) {
    if (movesMoney(target)) {
      setConfirming(target)
      return
    }
    run(target)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(p) => (
            <Button {...p} size="sm" variant="outline" disabled={loading}>
              {loading ? t("statusActions.updating") : t("statusActions.update")}
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="w-56">
          {targets.map((target) => (
            <DropdownMenuItem
              key={target}
              variant={target === "rejected" ? "destructive" : "default"}
              onClick={() => onSelect(target)}
            >
              {t(`actions.${target}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("statusActions.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("statusActions.confirmDescription")}
            </DialogDescription>
          </DialogHeader>

          <ul className="flex list-disc flex-col gap-1 ps-4 text-sm text-muted-foreground">
            <li>{t("statusActions.effectRefund")}</li>
            <li>{t("statusActions.effectBalance")}</li>
            <li>{t("statusActions.effectRestock")}</li>
          </ul>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(null)}
              disabled={loading}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => confirming && run(confirming)}
              disabled={loading}
            >
              {loading
                ? t("statusActions.refunding")
                : t("statusActions.receiveAndRefund")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
