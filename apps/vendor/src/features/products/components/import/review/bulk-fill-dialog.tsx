"use client"

import { useId, useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { InfoIcon, Loader2Icon, PaintBucketIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { SystemCategoryCombobox } from "@/features/products/components/form/pickers/system-category-picker"
import {
  BULK_FILL_STORE_IMPORT_OVERRIDES,
  type BulkFillStoreImportOverridesData,
  type StoreImportField,
} from "@/features/products/api"
import { storeImportErrorKey } from "@/features/products/lib/store-import"
import { getErrorCode } from "@/shared/lib/auth/graphql-errors"
import {
  bulkFillBlocker,
  bulkFillValues,
  bulkFillableFields,
} from "@/features/products/lib/store-import-bulk-fill"

/**
 * Fill stock and category across the review screen's current view.
 *
 * Every scanned product arrives with no stock and no category, and a merchant
 * with one warehouse count should not have to visit three hundred rows to type
 * it. This is the toolbar action and its confirmation; the rule about what it
 * may touch lives on the server (`back-end/src/store-import/review/bulk-fill.ts`).
 *
 * Three things the dialog says out loud, because each is a way the result
 * could otherwise surprise somebody:
 *
 * - **How many products**, named from the page query's own `total` for the
 *   filter on screen, which is the set the server fills.
 * - **That existing values are kept** unless the merchant ticks the box — the
 *   default never writes over their own edit or a scanned value.
 * - **That on a product with variants the stock lands on the first variant
 *   only.** The product-level cell is row 1 of the file, which is variant 1's
 *   row too, so "500 in stock" is not per variant.
 *
 * It is **unavailable while the draft is dirty**. The fill merges into what is
 * saved; letting it run underneath unsaved edits would make the order of the
 * two writes something the merchant never chose. Nothing here stages into the
 * draft — the fill is its own write, confirmed here, and the screen refetches
 * after it.
 */
export function BulkFillDialog({
  jobId,
  fields,
  total,
  onlyIncomplete,
  search,
  dirty,
  loading,
  onFilled,
}: {
  jobId: string
  fields: StoreImportField[]
  /** The page query's `total` for the filter on screen. */
  total: number
  onlyIncomplete: boolean
  search: string
  dirty: boolean
  loading: boolean
  onFilled: (result: { affected: number; matched: number }) => void
}) {
  const tf = useTranslations("products.import.review.fields")
  const tb = useTranslations("products.import.review.bulkFill")
  const te = useTranslations("products.import.errors")
  const locale = useLocale()
  const hintId = useId()
  const formId = useId()

  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [overwrite, setOverwrite] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fill, { loading: filling }] =
    useMutation<BulkFillStoreImportOverridesData>(
      BULK_FILL_STORE_IMPORT_OVERRIDES,
    )

  const fillable = bulkFillableFields(fields)
  // Before the server declares any, there is nothing to offer — the button
  // would open a dialog with no inputs in it.
  if (fillable.length === 0) return null

  const blocker = bulkFillBlocker({ dirty, loading, total })
  const payload = bulkFillValues(values, fillable)
  const filtered = onlyIncomplete || search.trim() !== ""

  // Opened fresh every time, from the handler rather than an effect: a
  // dialog that remembered last time's "500" would invite filling it twice.
  const onOpenChange = (next: boolean) => {
    if (filling) return
    if (next) {
      setValues({})
      setOverwrite(false)
      setError(null)
    }
    setOpen(next)
  }

  const setValue = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }))

  const onConfirm = async () => {
    if (!payload) return
    try {
      setError(null)
      const { data } = await fill({
        variables: {
          input: {
            id: jobId,
            fields: payload,
            only_incomplete: onlyIncomplete,
            search: search.trim() || null,
            overwrite,
          },
        },
      })
      const result = data?.bulkFillStoreImportOverrides
      setOpen(false)
      onFilled({
        affected: result?.affected ?? 0,
        matched: result?.matched ?? 0,
      })
    } catch (err) {
      const key = storeImportErrorKey(err)
      // A refused value is the merchant's to fix, so it gets a sentence that
      // says what to fix rather than "try again", which would fail the same way.
      setError(
        key
          ? te(key)
          : getErrorCode(err) === "VALIDATION_ERROR"
            ? tb("invalid")
            : te("generic"),
      )
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={blocker !== null}
        aria-label={tb("open")}
        aria-describedby={blocker === "dirty" ? hintId : undefined}
        title={blocker === "dirty" ? tb("saveFirst") : undefined}
        onClick={() => onOpenChange(true)}
      >
        <PaintBucketIcon aria-hidden />
        <span className="hidden md:inline">{tb("open")}</span>
      </Button>
      {blocker === "dirty" && (
        <span id={hintId} className="sr-only">
          {tb("saveFirst")}
        </span>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{tb("title")}</DialogTitle>
            <DialogDescription>
              {filtered
                ? tb("scopeFiltered", { count: total })
                : tb("scopeAll", { count: total })}{" "}
              {tb("excludedSkipped")}
            </DialogDescription>
          </DialogHeader>

          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            {fillable.map((field) => {
              const inputId = `${formId}-${field.key}`
              const label = tf(`${field.key}.label`)
              return field.kind === "category" ? (
                <div
                  key={field.key}
                  role="group"
                  aria-labelledby={`${inputId}-label`}
                  className="flex flex-col gap-1.5"
                >
                  <p id={`${inputId}-label`} className="text-sm font-medium">
                    {label}
                  </p>
                  <SystemCategoryCombobox
                    chrome={false}
                    selectedId={values[field.key] ?? ""}
                    snapshots={{}}
                    locale={locale}
                    onSelect={(id) => setValue(field.key, id)}
                    onClear={() => setValue(field.key, "")}
                  />
                </div>
              ) : (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={inputId}>{label}</Label>
                  <Input
                    id={inputId}
                    inputMode={field.kind === "integer" ? "numeric" : undefined}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValue(field.key, event.target.value)}
                    placeholder={tb("keepPlaceholder")}
                    dir="auto"
                  />
                </div>
              )
            })}

            <div className="flex items-start gap-2">
              <Checkbox
                id={`${formId}-overwrite`}
                checked={overwrite}
                onCheckedChange={(checked) => setOverwrite(checked === true)}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <Label
                  htmlFor={`${formId}-overwrite`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {tb("overwrite")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {overwrite ? tb("overwriteOn") : tb("overwriteOff")}
                </p>
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {tb("variantNote")}
            </p>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </form>

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={filling} />}
            >
              {tb("cancel")}
            </DialogClose>
            <Button
              type="submit"
              form={formId}
              disabled={!payload || filling}
              aria-busy={filling || undefined}
            >
              {filling && <Loader2Icon className="animate-spin" />}
              {tb("confirm", { count: total })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
