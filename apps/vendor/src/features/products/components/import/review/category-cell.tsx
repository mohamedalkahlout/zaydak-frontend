"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Loader2Icon, SparklesIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { SystemCategoryCombobox } from "@/features/products/components/form/pickers/system-category-picker"
import {
  SUGGEST_SYSTEM_CATEGORIES,
  type SystemCategorySuggestion,
  type SystemCategorySuggestionsData,
} from "@/features/products/api"
import { aiErrorKey, plainLine } from "@/features/products/lib/store-import-ai"

/**
 * The category cell: the real taxonomy picker, and a way to be told what to
 * pick.
 *
 * Before this the cell was a bare text input, which asked a merchant to know
 * and type a Google-taxonomy id — on one of the two fields the needs-attention
 * filter counts, so it was simultaneously the work this screen exists for and
 * the least usable thing on it. The picker is the product form's own, shared
 * rather than rebuilt: the tree, the search, the drill-down and the keyboard
 * model come with it, and only the form's label and metafield badge are turned
 * off (`chrome={false}`).
 *
 * The suggestion asks a model for a taxonomy PATH and resolves it against the
 * real tree on the server, so a candidate always exists — an invented category
 * produces no suggestion rather than a plausible wrong one. A decisive answer
 * is applied by one press; anything ambiguous is offered as chips, because
 * being handed a category is only better than typing one if it is right.
 *
 * Choosing goes through the same `onChange` a typed value did, so it stages
 * into the draft and Revert, Discard, Save and the leave guard need to know
 * nothing about where the value came from.
 */
export function CategoryCell({
  value,
  onChange,
  productName,
  productDescription,
  productBrand,
  handle,
  disabled,
}: {
  /** The staged or saved `system_category_id`, or an empty string. */
  value: string
  onChange: (next: string) => void
  /** The title as it will be imported — the merchant's edit, not the scan. */
  productName: string
  productDescription: string
  productBrand: string
  /** The caller's key for this product, echoed back on the answer. */
  handle: string
  disabled?: boolean
}) {
  const t = useTranslations("products.import.review")
  const locale = useLocale()
  const [suggest, { loading }] = useMutation<SystemCategorySuggestionsData>(
    SUGGEST_SYSTEM_CATEGORIES,
  )
  const [options, setOptions] = useState<SystemCategorySuggestion[] | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  /**
   * Breadcrumbs for ids the picker has been told about.
   *
   * The picker resolves a label itself once the flat taxonomy has loaded, so
   * this only covers the gap before that — and, more usefully, an id that came
   * from a suggestion, whose label the server already sent.
   */
  const [snapshots, setSnapshots] = useState<Record<string, string>>({})

  const ask = () => {
    if (loading) return
    setError(null)
    setOptions(null)

    void suggest({
      variables: {
        input: {
          products: [
            {
              ref: handle,
              name: productName,
              // The description is HTML from the source store; the server caps
              // what it reads, but sending markup only wastes prompt budget.
              description:
                plainLine(productDescription).slice(0, 2000) || undefined,
              brand: productBrand || undefined,
            },
          ],
        },
        locale,
      },
      fetchPolicy: "no-cache",
      onCompleted: (data) => {
        const payload = data?.suggestSystemCategories
        const answer = payload?.data?.find((entry) => entry.ref === handle)
        if (!answer || answer.categories.length === 0) {
          // `generated` is what tells "no provider answered" (retry is worth
          // offering) from "it read the product and had nothing confident to
          // say" (retrying will produce the same nothing).
          setError(
            payload?.generated ? t("categoryNoSuggestion") : t("aiFailed"),
          )
          return
        }
        setSnapshots((previous) => ({
          ...previous,
          ...Object.fromEntries(
            answer.categories.map((entry) => [entry.id, entry.label]),
          ),
        }))
        // Decisive means the model's leaf matched exactly one node: there is
        // no choice to put in front of the merchant, so it is applied.
        if (answer.decisive) onChange(answer.categories[0]!.id)
        else setOptions(answer.categories)
      },
      onError: (err) => setError(t(aiErrorKey(err))),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <SystemCategoryCombobox
        chrome={false}
        selectedId={value}
        snapshots={snapshots}
        locale={locale}
        onSelect={onChange}
        onClear={() => onChange("")}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={disabled || loading || !productName.trim()}
          aria-busy={loading || undefined}
          onClick={ask}
        >
          {loading ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <SparklesIcon />
          )}
          {t("categorySuggest")}
        </Button>

        {options?.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="xs"
            variant="outline"
            title={option.label}
            onClick={() => {
              onChange(option.id)
              setOptions(null)
            }}
          >
            <span className="max-w-56 truncate">{option.label}</span>
          </Button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
