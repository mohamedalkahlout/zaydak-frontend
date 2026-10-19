import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleIcon,
  CircleOffIcon,
  ClockIcon,
  HelpCircleIcon,
  LoaderIcon,
  PackageIcon,
  RotateCcwIcon,
  TruckIcon,
  Undo2Icon,
  XCircleIcon,
} from "lucide-react"
import type { FilterValueOption } from "@/shared/components/filter-bar"
import type { OrderStatus, PaymentStatus } from "@/features/orders/types"
import {
  SALES_CHANNELS,
  SALES_CHANNEL_META,
  type SalesChannel,
} from "@/shared/lib/sales-channels"

export const PAGE_SIZE = 15

/**
 * The eight order statuses and eleven payment statuses the list filters by,
 * each with the glyph its chip and its badge are drawn with.
 *
 * They carry **no label**. The English one that used to sit here was a second
 * copy of the badge's own, and the two had already drifted: the filter menu
 * offered "COD" while the order it filtered to said "Cash on delivery". What a
 * value reads as is now a message key derived from the value —
 * `orders.orderStatus.<value>` and `orders.paymentStatus.<value>` — resolved by
 * whichever component draws it, so there is one list of words per status.
 *
 * `payment-success` is deliberately absent: it is the same state as
 * `payment-completed` under an older name, and offering both would put two
 * rows reading "Paid" on one menu. The badge still renders it, from its own key.
 */
export const ORDER_STATUS_OPTIONS: readonly FilterValueOption<OrderStatus>[] = [
  { value: "order-pending", icon: HelpCircleIcon },
  { value: "order-processing", icon: LoaderIcon },
  { value: "order-at-local-facility", icon: PackageIcon },
  { value: "order-out-for-delivery", icon: TruckIcon },
  { value: "order-completed", icon: CheckCircle2Icon },
  { value: "order-cancelled", icon: CircleOffIcon },
  { value: "order-refunded", icon: RotateCcwIcon },
  { value: "order-failed", icon: XCircleIcon },
]

export const PAYMENT_STATUS_OPTIONS: readonly FilterValueOption<PaymentStatus>[] =
  [
    { value: "payment-pending", icon: HelpCircleIcon },
    { value: "payment-processing", icon: LoaderIcon },
    { value: "payment-completed", icon: CheckCircle2Icon },
    { value: "payment-failed", icon: XCircleIcon },
    { value: "payment-reversal", icon: Undo2Icon },
    { value: "payment-refunded", icon: RotateCcwIcon },
    { value: "payment-cash-on-delivery", icon: CircleIcon },
    { value: "payment-cash", icon: CircleIcon },
    { value: "payment-wallet", icon: CircleIcon },
    { value: "payment-awaiting-for-approval", icon: ClockIcon },
    { value: "payment-mismatch", icon: AlertTriangleIcon },
  ]

export const CHANNEL_OPTIONS: readonly FilterValueOption<SalesChannel>[] =
  SALES_CHANNELS.map((ch) => ({
    value: ch,
    icon: SALES_CHANNEL_META[ch].icon,
  }))
