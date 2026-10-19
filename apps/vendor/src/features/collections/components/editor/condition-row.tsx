"use client"

import { useTranslations } from "next-intl"
import { useWatch } from "react-hook-form"
import { TrashIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  OPERATORS_BY_FIELD,
  defaultOperator,
  isPresenceOperator,
  valueKindOf,
} from "@/features/collections/lib/rules"
import type {
  CollectionFormApi,
  CollectionRuleField,
  ConditionInput,
} from "@/features/collections/validations/shop-collection"
import { AttributePicker } from "./attribute-picker"
import { ValueEditor } from "./value-editor"

export type ConditionPath =
  | `sources.${number}.conditions.${number}`
  | `sources.${number}.exclude.conditions.${number}`

/**
 * One condition: attribute, operator, and the values they are tested against.
 * Changing the attribute resets both of the others — an operator that the new
 * field does not accept is rejected server-side, and a leftover operand means
 * something different against a different column.
 */
export function ConditionRow({
  form,
  path,
  fields,
  onRemove,
  invalid,
}: {
  form: CollectionFormApi
  path: ConditionPath
  fields: CollectionRuleField[]
  onRemove: () => void
  invalid?: boolean
}) {
  const t = useTranslations("collections")
  const condition = useWatch({
    control: form.control,
    name: path,
  }) as ConditionInput | undefined

  if (!condition) return null

  const field = condition.field
  const operator = condition.operator
  const operators = OPERATORS_BY_FIELD[field] ?? []

  const set = (next: Partial<ConditionInput>) => {
    form.setValue(
      path,
      { ...condition, ...next },
      { shouldDirty: true, shouldValidate: false },
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-2.5">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <AttributePicker
            value={field}
            fields={fields}
            onChange={(next) =>
              set({
                field: next,
                operator: defaultOperator(next),
                values: [],
                attribute_key: "",
              })
            }
          />
          <Select
            value={operator}
            onValueChange={(value) =>
              set({
                operator: value as ConditionInput["operator"],
                // A presence check has no operand, and a switch away from one
                // starts empty rather than with a value nobody typed.
                values: [],
              })
            }
          >
            <SelectTrigger size="sm" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {t(`operators.${op}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t("conditions.remove")}
          onClick={onRemove}
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>

      {field === "attribute" && (
        <Input
          className="h-9"
          placeholder={t("conditions.attributeKey")}
          value={condition.attribute_key ?? ""}
          onChange={(e) => set({ attribute_key: e.target.value })}
        />
      )}

      {!isPresenceOperator(operator) && (
        <ValueEditor
          field={field}
          operator={operator}
          values={condition.values}
          invalid={invalid}
          onChange={(values) => set({ values })}
        />
      )}

      {field === "title" && valueKindOf(field, operator) === "text" && (
        <p className="text-[11px] text-muted-foreground">
          {t("conditions.caseSensitive")}
        </p>
      )}
    </div>
  )
}
