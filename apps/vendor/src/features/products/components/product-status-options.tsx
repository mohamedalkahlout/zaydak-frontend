"use client"

import { useTranslations } from "next-intl"
import { SelectItem } from "@repo/ui/components/select"
import { PRODUCT_STATUS_CHOICES } from "@/features/products/validations/product"

/**
 * The three options, rendered once and used by both the form's Status card and
 * the list's status cell.
 *
 * They are a shared component rather than two `.map()`s over the same array
 * because the row is more than its text: the leading, the indent, and the
 * width the description wraps at all have to agree, and a second copy is a
 * second place for them to stop agreeing.
 *
 * `whitespace-normal` is load-bearing — `SelectItem`'s own text wrapper is
 * `whitespace-nowrap`, which would run a long description off the popup
 * instead of wrapping it.
 */
export function ProductStatusOptions() {
  const tStatus = useTranslations("products.status")
  const tDesc = useTranslations("products.statusDesc")
  return (
    <>
      {PRODUCT_STATUS_CHOICES.map((choice) => (
        <SelectItem
          key={choice.value}
          value={choice.value}
          className="items-start py-2 pr-9 pl-2.5"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm leading-5 font-medium">
              {tStatus(choice.value)}
            </span>
            <span className="text-xs leading-snug whitespace-normal text-muted-foreground">
              {tDesc(choice.value)}
            </span>
          </span>
        </SelectItem>
      ))}
    </>
  )
}
