"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  FilePlusIcon,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { CREATE_DRAFT_ORDER } from "@/features/orders/api"
import { draftCustomerErrorKey } from "@/features/orders/lib/drafts/customer"
import type { CreateDraftOrderResponse } from "@/features/orders/types"
import {
  GET_ABANDONED_CARTS,
  GET_ABANDONED_CARTS_BY_PRODUCT,
  GET_ABANDONED_CARTS_SUMMARY,
  HIDE_ABANDONED_CART,
  RECORD_ABANDONED_CART_DRAFT,
  UNHIDE_ABANDONED_CART,
} from "@/features/abandoned-carts/api"
import type { AbandonedCart } from "@/features/abandoned-carts/types"

export function AbandonedCartsRowActions({
  cart,
  remindLabel,
  onRemind,
}: {
  cart: AbandonedCart
  remindLabel: string
  onRemind: (cart: AbandonedCart) => void
}) {
  const t = useTranslations("abandonedCarts")
  const params = useParams<{ shopSlug: string }>()
  const router = useRouter()
  const shopSlug = params?.shopSlug ?? ""
  const [hideCart] = useMutation(HIDE_ABANDONED_CART)
  const [unhideCart] = useMutation(UNHIDE_ABANDONED_CART)
  const [createDraft] = useMutation<CreateDraftOrderResponse>(CREATE_DRAFT_ORDER)
  const [recordDraft] = useMutation(RECORD_ABANDONED_CART_DRAFT)
  const [busy, setBusy] = useState(false)

  const refetch = [
    GET_ABANDONED_CARTS,
    GET_ABANDONED_CARTS_BY_PRODUCT,
    GET_ABANDONED_CARTS_SUMMARY,
  ]

  const toggleHidden = async () => {
    setBusy(true)
    try {
      if (cart.hidden) {
        await unhideCart({ variables: { id: cart.id }, refetchQueries: refetch })
        sileo.success({ title: t("toasts.shown") })
      } else {
        await hideCart({ variables: { id: cart.id }, refetchQueries: refetch })
        sileo.success({ title: t("toasts.hidden") })
      }
    } catch {
      sileo.error({ title: t("toasts.hideFailed") })
    } finally {
      setBusy(false)
    }
  }

  const createOrder = async () => {
    if (cart.items.length === 0) return
    setBusy(true)
    try {
      const result = await createDraft({
        variables: {
          input: {
            lines: cart.items.map((item) => ({
              product_id: item.product_id,
              variation_option_id: item.variation_option_id ?? undefined,
              quantity: item.quantity,
            })),
            customer_id: cart.customer?.id,
            customer_name: cart.customer?.name ?? undefined,
            customer_contact:
              cart.customer?.email ?? cart.customer?.phone ?? undefined,
            note: t("draftNote"),
          },
        },
      })
      const id = result.data?.createDraftOrder?.data?.id
      if (!id) throw new Error("missing draft")
      await recordDraft({
        variables: { input: { cart_id: cart.id, draft_order_id: id } },
        refetchQueries: refetch,
      })
      sileo.success({ title: t("toasts.draftCreated") })
      router.push(`/store/${shopSlug}/orders/drafts/${id}`)
    } catch (err) {
      // The Apollo error link keeps VALIDATION_ERROR silent, so this toast is
      // all the merchant sees. `invalid_customer` here means the cart's own
      // customer was deleted: nothing on this screen fixes that, so say what
      // can. Nothing is retried as a guest draft.
      if (draftCustomerErrorKey(err)) {
        sileo.error({
          title: t("toasts.draftCustomerDeleted"),
          description: t("toasts.draftCustomerDeletedHint"),
        })
      } else {
        sileo.error({ title: t("toasts.draftFailed") })
      }
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 disabled:opacity-0"
        onClick={() => onRemind(cart)}
        disabled={cart.hidden || cart.reminder_status === "COMPLETED"}
      >
        {remindLabel}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(p) => (
            <Button
              {...p}
              variant="ghost"
              size="icon-sm"
              aria-label={t("rowActions")}
              disabled={busy}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => onRemind(cart)}
            disabled={cart.hidden || cart.reminder_status === "COMPLETED"}
          >
            {remindLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleHidden}>
            {cart.hidden ? (
              <EyeIcon className="size-4" />
            ) : (
              <EyeOffIcon className="size-4" />
            )}
            {cart.hidden ? t("actions.show") : t("actions.hide")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={createOrder}>
            <FilePlusIcon className="size-4" />
            {t("actions.createOrder")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
