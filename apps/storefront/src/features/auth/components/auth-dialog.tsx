"use client"

import { Suspense } from "react"
import { useTranslations } from "next-intl"

import { Dialog, DialogContent } from "@repo/ui/components/dialog"

import { useAuthDialogStore } from "@/shared/stores/auth-dialog"
import { LoginForm } from "./login-form"

/**
 * Signing in, over the page the shopper was already on.
 *
 * Mounted once by `ShopShell`, for the same reason the cart drawer is: what
 * opens it (the header's account button, the header panel, the bank-transfer
 * block on checkout) is nowhere near what renders it, and a popup nested
 * inside the `fixed`, backdrop-blurred header would inherit that stacking
 * context.
 *
 * One panel: a phone number, then the code texted to it. There is no second
 * card to stack — signing up is the same step as signing in. It renders
 * nothing at all until something opens it, so no page in the shop pays for a
 * form nobody asked for, and closing it unmounts the form, which is also what
 * clears a half-typed code rather than leaving it to reappear later.
 */
export function AuthDialog() {
  const t = useTranslations("common")
  const open = useAuthDialogStore((s) => s.stack.length > 0)
  const redirect = useAuthDialogStore((s) => s.redirect)
  const close = useAuthDialogStore((s) => s.close)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent
        scroll="viewport"
        className="gap-0 rounded-2xl p-0 sm:max-w-md"
        closeLabel={t("close")}
      >
        {/*
          `useSearchParams` suspends, and the form reads it for the `?redirect`
          a route guard may have written. Inside the popup that value is
          overridden anyway, but the hook still runs — so the boundary is here
          rather than at every screen the popup can open over.
        */}
        {open && (
          <Suspense fallback={null}>
            <LoginForm variant="dialog" redirect={redirect} />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  )
}
