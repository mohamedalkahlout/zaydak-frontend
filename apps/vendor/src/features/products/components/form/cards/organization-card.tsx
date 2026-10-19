"use client"

import { Controller } from "react-hook-form"
import { useTranslations } from "next-intl"
import { useQuery } from "@apollo/client/react"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldLabel } from "@repo/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import type {
  ProductFormApi,
  SaleType,
} from "@/features/products/validations/product"
import type { InitialProductSnapshots } from "@/features/products/lib/form/from-product-entry"
import { GET_PRODUCT_ORGANIZATION_OPTIONS } from "@/features/products/api"
import type { ProductOrganizationOptionsResponse } from "@/features/products/types"
import { CollectionPicker } from "../pickers/collection-picker"
import { TagPicker } from "../pickers/tag-picker"
import { ValueCombobox } from "../pickers/value-combobox"

// Pricing mechanism — orthogonal to structure (PRODUCTS.md §4).
//
// The enum drives the list and `products.organization.saleType.<ENUM>` supplies
// the label, so the option set stays the server's and only the wording is
// translated. The list's "Selling method" filter reads the same keys.
const SALE_TYPE_CHOICES: SaleType[] = ["FIXED_PRICE", "NEGOTIABLE", "AUCTION"]

interface OrganizationCardProps {
  form: ProductFormApi
  snapshots?: InitialProductSnapshots
}

/**
 * Sidebar "Product organization" card — type, vendor, selling method,
 * collections and tags.
 *
 * Type and Vendor are both free text on the server and both are pickers here,
 * seeded with what the shop already uses (`productOrganizationOptions`). That
 * is the point: as plain inputs they collect three spellings of one vendor,
 * and as pickers a merchant picks "Acme" in one click and only a genuinely
 * new value is typed.
 *
 * **Vendor was removed from this card once**, when it was such an input:
 * merchants left it blank, `brand` was null on effectively every row, and the
 * catalogue search reads it — a shop selling a "MacBook Air M3" with no brand
 * was telling customers it had no laptops. The answer then was to stop asking
 * and let `ProductEnrichmentService` fill it after each save. That still
 * happens, and still only when the field is blank (`wantsBrand = !product.brand`),
 * so this control does not fight the worker: it lets a merchant who *does*
 * know the vendor say so, and the worker keeps covering the ones who do not.
 *
 * Type is `type_name`, not `product_type`. The latter is the structural enum
 * (SIMPLE / VARIABLE / DIGITAL / SERVICE) chosen once in the "Add product"
 * dialog and derived from the option axes thereafter; this is the merchant's
 * own word for the thing ("Perfume"), which is what Shopify's CSV `Type`
 * column carries and what the importer used to drop for want of a column.
 */
export function OrganizationCard({ form, snapshots }: OrganizationCardProps) {
  const t = useTranslations("products.organization")
  const { control } = form

  // Cache-first and shared with every other mount of this card: the values
  // change only when a product is saved with a new one.
  const { data } = useQuery<ProductOrganizationOptionsResponse>(
    GET_PRODUCT_ORGANIZATION_OPTIONS,
    { fetchPolicy: "cache-first" },
  )
  const options = data?.productOrganizationOptions?.data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/*
          **Product kind used to be a Select here.**

          The kind is chosen once, in the "Add product" dialog, which hands it
          to the form through `?kind=` — so a second control asking the same
          question on every edit was only ever a way to get a different answer
          than the one the product was created with. SIMPLE vs VARIABLE was
          never the merchant's to set anyway: `useVariantOptions` flips it from
          the option axes.

          `product_type` is untouched otherwise — still on the schema, still in
          the form's state (seeded by `fromProductEntry` on edit and by
          `productFormDefaults(kind)` on create), and still sent on submit, so
          an edit round-trips the kind rather than clearing it.
        */}

        <Field>
          <FieldLabel>{t("type")}</FieldLabel>
          <Controller
            control={control}
            name="type_name"
            render={({ field }) => (
              <ValueCombobox
                label={t("typeLabel")}
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                options={options?.types ?? []}
                placeholder={t("typePlaceholder")}
                searchPlaceholder={t("typeSearch")}
              />
            )}
          />
        </Field>

        <Field>
          <FieldLabel>{t("vendor")}</FieldLabel>
          <Controller
            control={control}
            name="brand"
            render={({ field }) => (
              <ValueCombobox
                label={t("vendor")}
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                options={options?.vendors ?? []}
                placeholder={t("vendorPlaceholder")}
                searchPlaceholder={t("vendorSearch")}
              />
            )}
          />
        </Field>

        <Field>
          <FieldLabel>{t("sellingMethod")}</FieldLabel>
          <Controller
            control={control}
            name="sale_type"
            render={({ field }) => (
              <Select
                value={(field.value as string) ?? "FIXED_PRICE"}
                onValueChange={(v) => field.onChange(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALE_TYPE_CHOICES.map((choice) => (
                    <SelectItem key={choice} value={choice}>
                      {t(`saleType.${choice}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        {/*
          **Target audience is still not here**, and only Vendor came back.

          It was the other field merchants left blank, and unlike a vendor it
          is not something a merchant can look up — MEN / WOMEN / KIDS /
          UNISEX is a judgement the enrichment worker makes from the product's
          own name and description as well as anyone. `target_audience` stays
          on the schema and in the form's state, seeded on edit and sent on
          submit, so a save round-trips whatever the worker wrote rather than
          clearing it.
        */}

        {/*
          Collections and tags carry their own label rows — each pairs the name
          with the button that opens its panel, which a `FieldLabel` above the
          control has nowhere to put.
        */}
        <CollectionPicker form={form} snapshots={snapshots?.collections} />

        <TagPicker form={form} snapshots={snapshots?.tags} />
      </CardContent>
    </Card>
  )
}
