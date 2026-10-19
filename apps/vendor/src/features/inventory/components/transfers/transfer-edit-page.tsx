"use client"

import { useSuspenseQuery } from "@apollo/client/react"
import { GET_INVENTORY_TRANSFER } from "@/features/inventory/api"
import { TransferForm, type ExistingTransfer } from "./transfer-form"

type DetailResp = {
  inventoryTransfer: { success: boolean; data: ExistingTransfer & { status: string } }
}

/**
 * Edit a DRAFT transfer. Reuses the shared TransferForm, prefilled from the
 * existing transfer. The backend only accepts edits while the transfer is
 * still DRAFT — the detail page hides the Edit action otherwise.
 */
export function TransferEditPage({ transferId }: { transferId: string }) {
  const { data } = useSuspenseQuery<DetailResp>(GET_INVENTORY_TRANSFER, {
    variables: { id: transferId },
  })
  const transfer = data?.inventoryTransfer?.data
  if (!transfer) return null
  return <TransferForm mode="edit" transfer={transfer} />
}
