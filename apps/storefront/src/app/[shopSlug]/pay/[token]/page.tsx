import { Suspense } from "react"
import type { Metadata } from "next"

import { OrderPayment } from "@/features/checkout/components/order-payment"

/**
 * The pay link an order placed in a WhatsApp chat is sent.
 *
 * Public by construction: `pay` is in neither
 * `PRIVATE_SEGMENTS` nor `GUEST_ONLY_SEGMENTS`. A customer paying from a
 * chat may never have signed in on this browser, and the token in the path
 * is the whole permission — for this one order's payment.
 *
 * Never indexed: every URL here is a credential.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <Suspense>
      <OrderPayment token={token} />
    </Suspense>
  )
}
