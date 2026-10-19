"use client"

import { ListFilterIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import {
  PRODUCT_FILTER_KEYS,
  filterValueMessageKey,
  type ProductFilterKeyId,
} from "@/features/products/lib/list/filters"

export function ProductsAddFilter({
  usedFields,
  onPickField,
  onPickValue,
}: {
  usedFields: Set<string>
  onPickField: (id: ProductFilterKeyId) => void
  onPickValue: (id: ProductFilterKeyId, value: string) => void
}) {
  const t = useTranslations("filterBar")
  // The key table carries values only; its words are the products catalogue's.
  const tProducts = useTranslations("products")
  const available = PRODUCT_FILTER_KEYS.filter((key) => !usedFields.has(key.id))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            aria-label={t("addFilter")}
          >
            <ListFilterIcon className="size-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("addFilter")}</DropdownMenuLabel>
          {available.length === 0 ? (
            <div className="px-1.5 py-2 text-sm text-muted-foreground">
              {t("noFiltersLeft")}
            </div>
          ) : (
            available.map((key) =>
              key.options && key.options.length > 0 ? (
                <DropdownMenuSub key={key.id}>
                  <DropdownMenuSubTrigger>
                    {tProducts(`filters.keys.${key.id}.label`)}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    align="start"
                    side="inline-end"
                    className="min-w-48"
                  >
                    {key.options.map((option) => (
                      <DropdownMenuItem
                        key={option}
                        onClick={() => onPickValue(key.id, option)}
                      >
                        <span className="truncate">
                          {tProducts(filterValueMessageKey(key.id, option))}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem
                  key={key.id}
                  onClick={() => onPickField(key.id)}
                >
                  {tProducts(`filters.keys.${key.id}.label`)}
                </DropdownMenuItem>
              ),
            )
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
