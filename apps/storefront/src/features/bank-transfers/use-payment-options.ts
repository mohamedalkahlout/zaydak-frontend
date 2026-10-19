"use client"

import { useMemo } from "react"
import { useQuery } from "@apollo/client/react"
import { PAYMENT_OPTIONS } from "./api"

export type PaymentMethod = "CASH_ON_DELIVERY" | "STRIPE" | "BANK_TRANSFER"
const SUPPORTED = new Set<string>(["CASH_ON_DELIVERY", "STRIPE", "BANK_TRANSFER"])

export function usePaymentOptions() {
  const query = useQuery(PAYMENT_OPTIONS, {
    fetchPolicy: "cache-and-network",
  })
  const rawGateways = query.data?.shopPaymentOptions?.data?.available_gateways
  // Never invent a payment method while the store's settings are unavailable.
  const methods: PaymentMethod[] = useMemo(() => {
    return (rawGateways ?? []).filter((method): method is PaymentMethod =>
      SUPPORTED.has(method),
    )
  }, [rawGateways])

  return { ...query, methods }
}
