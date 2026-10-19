"use client"

import { useTranslations } from "next-intl"
import { XIcon } from "lucide-react"
import {
  removeConditionAt,
  serializeValue,
  type Condition,
  type Expr,
  type FlatCondition,
  type TopLogic,
} from "@/features/segments/lib/shopifyql"
import { cn } from "@/shared/lib/utils"

/**
 * QueryChips — Phase 10C overlay.
 *
 * Renders the editor's flat condition list as removable pills. Each chip
 * shows `field operator value`; clicking the × removes that condition
 * from the AST and the editor's text re-derives.
 *
 * When the AST is too nested for chip rendering, the parent component
 * hides this overlay and falls back to text-only mode.
 *
 *   ┌───────────────────────────────────────┐
 *   │ [amount_spent > 100 ×] AND            │
 *   │ [number_of_orders >= 5 ×] AND         │
 *   │ [customer_tags CONTAINS 'VIP' ×]      │
 *   └───────────────────────────────────────┘
 */
interface QueryChipsProps {
  ast: Expr
  conditions: FlatCondition[]
  topLogic: TopLogic | undefined
  /** Called with the new AST after a removal (parent serializes back). */
  onAstChange: (next: Expr | null) => void
  className?: string
}

export function QueryChips({
  ast,
  conditions,
  topLogic,
  onAstChange,
  className,
}: QueryChipsProps) {
  const t = useTranslations("segments.queryChips")
  if (!conditions.length) return null

  const handleRemove = (idx: number) => {
    const next = removeConditionAt(ast, idx)
    onAstChange(next)
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/30 p-2",
        className,
      )}
      aria-label={t("label")}
    >
      {conditions.map((flat, i) => (
        <span key={flat.index} className="contents">
          <Chip
            condition={flat.condition}
            onRemove={() => handleRemove(flat.index)}
          />
          {i < conditions.length - 1 && topLogic && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {topLogic}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

interface ChipProps {
  condition: Condition
  onRemove: () => void
}

function Chip({ condition, onRemove }: ChipProps) {
  const t = useTranslations("segments.queryChips")
  const label = formatConditionLabel(condition)
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
      <span className="font-semibold text-blue-700 dark:text-blue-400">
        {condition.field.name}
      </span>
      <span className="text-muted-foreground">{condition.operator}</span>
      <span className="text-foreground">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        aria-label={t("remove", { field: condition.field.name })}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  )
}

function formatConditionLabel(c: Condition): string {
  if (c.operator === "IS NULL" || c.operator === "IS NOT NULL") return ""
  try {
    return serializeValue(c.value)
  } catch {
    // Serializing a malformed value (e.g. BETWEEN without `between` payload)
    // shouldn't crash the chip — fall back to a generic label.
    return "…"
  }
}
