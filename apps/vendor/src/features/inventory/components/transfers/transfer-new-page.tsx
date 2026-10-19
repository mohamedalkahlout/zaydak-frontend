"use client"

import { TransferForm } from "./transfer-form"

/**
 * Shopify "Create transfer" wizard. Thin wrapper over the shared TransferForm
 * in create mode — submitting leaves the new transfer in DRAFT, and the detail
 * page handles the SEND / RECEIVE / CANCEL transitions.
 */
export function TransferNewPage() {
  return <TransferForm mode="create" />
}
