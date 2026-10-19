"use client"

import type { ProductFormApi } from "@/features/products/validations/product"

/**
 * Publishing controls.
 *
 * The digital-product flag was removed for V1 (D12): file delivery after
 * payment is not implemented, and the API refuses `is_digital` / DIGITAL
 * creates. Re-introduce the checkbox when OrderedFile issuance ships.
 */
export function PublishingCard({ form: _form }: { form: ProductFormApi }) {
  return null
}
