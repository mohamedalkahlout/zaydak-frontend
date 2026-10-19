"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"

/**
 * The prompt behind `useLeaveGuard`: "you have unsaved changes — stay or go?"
 *
 * Mounted once, in `DashboardShell`, next to the header that carries the save
 * bar, so any screen that arms the guard gets the same dialog and nobody
 * writes a second copy. It renders nothing until a navigation is `pending`.
 *
 * Leaving runs the guard's `onLeave` first and only then re-issues the
 * navigation — the exact action that was held when the caller supplied one,
 * otherwise a push of the parked href — so the destination mounts over a
 * screen that is already clean rather than one still holding the draft.
 *
 * `DialogContent` carries `data-slot="dialog-content"`, which is what the
 * settings overlay's Escape-to-close yields to; Escape here closes the prompt
 * (staying) rather than firing a second exit behind it.
 */
export function LeaveGuardDialog() {
  const t = useTranslations("leaveGuard")
  const router = useRouter()
  const pending = useLeaveGuardStore((s) => s.pending)
  const confirm = useLeaveGuardStore((s) => s.confirm)
  const cancel = useLeaveGuardStore((s) => s.cancel)

  const leave = () => {
    const held = confirm()
    if (!held) return
    if (held.proceed) held.proceed()
    else router.push(held.href)
  }

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) cancel()
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={cancel}>
            {t("stay")}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={leave}>
            {t("leave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
