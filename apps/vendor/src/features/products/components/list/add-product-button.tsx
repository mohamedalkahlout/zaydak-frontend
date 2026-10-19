"use client"

import { PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button, type ButtonProps } from "@repo/ui/components/button"
import { CreateProductDialog } from "./create-product-dialog"

interface AddProductButtonProps {
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
  /** Replaces the `products.addProduct` label for a caller that speaks in
   *  its own voice. */
  label?: string
}

/**
 * The one "Add product" trigger.
 *
 * Every entry point that wants a *button* — the list header, the empty
 * state — renders this rather than its own `Button` + `CreateProductDialog`
 * pair, so there is no way in that skips the kind picker. The dashboard
 * home's onboarding tile is the one exception, and only because its trigger
 * is the whole card: it drives `CreateProductDialog` in controlled mode, so
 * it still goes through the picker. That is the invariant — not this
 * component. The home card used to be a plain link to `/products/new`, which
 * landed every new merchant on the bare simple-product form; that is the
 * exact shape this exists to prevent.
 *
 * The trigger reads `products.addProduct`; the dialog behind it reads
 * `products.kinds.*`, keyed by the enum.
 */
export function AddProductButton({
  variant,
  size = "sm",
  className,
  label,
}: AddProductButtonProps) {
  const t = useTranslations("products")
  return (
    <CreateProductDialog
      trigger={
        <Button variant={variant} size={size} className={className}>
          {/* The Button's own icon slot: sized per `size`, spaced with a
              logical padding, so it sits right under RTL where a physical
              `mr-1` put the gap between the icon and the edge. */}
          <PlusIcon data-icon="inline-start" />
          {label ?? t("addProduct")}
        </Button>
      }
    />
  )
}
