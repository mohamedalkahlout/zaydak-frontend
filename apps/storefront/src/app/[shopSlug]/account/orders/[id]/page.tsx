import { Suspense } from "react"

import { OrderDetail } from "@/features/orders/components/order-detail"

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense>
      <OrderDetail orderId={id} />
    </Suspense>
  )
}
