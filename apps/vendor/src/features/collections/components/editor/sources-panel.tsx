"use client"

import { useTranslations } from "next-intl"
import { useWatch } from "react-hook-form"
import { PlusIcon } from "lucide-react"
import { newSource } from "@/features/collections/lib/rules"
import {
  MAX_TOTAL_CONDITIONS,
  countConditions,
  type CollectionFormApi,
  type SourceInput,
} from "@/features/collections/validations/shop-collection"
import { cn } from "@/shared/lib/utils"
import { SourceCard } from "./source-card"

const MAX_SOURCES = 10

/**
 * The condition count stays off screen until it is about to matter. An
 * always-on "3 of 60" was noise on every collection that will never get near
 * the cap; the number only helps once it is a few rows from becoming a
 * refusal, and it turns red at the line so the disabled buttons read as a
 * limit rather than a bug.
 */
const BUDGET_NOTICE_FROM = MAX_TOTAL_CONDITIONS - 10

/**
 * The right-hand column: every source the collection draws from, in the order
 * they were added, and one button to add another. Sources union — a product
 * that two of them select shows up once.
 */
export function SourcesPanel({
  form,
  collectionId,
}: {
  form: CollectionFormApi
  collectionId?: string
}) {
  const t = useTranslations("collections")
  const sources = (useWatch({ control: form.control, name: "sources" }) ??
    []) as SourceInput[]

  const setSources = (next: SourceInput[]) =>
    form.setValue("sources", next, { shouldDirty: true })

  // Hand-picked products are one set for the whole collection, so the button
  // that edits them belongs to a single card — the first that can hold them.
  const manualOwner = sources.findIndex((source) => source.kind === "PRODUCTS")

  // Derived from the watched array on every render, never cached: a card
  // replaces its whole source object on each edit, so a count taken once
  // would lag the row that just crossed the line.
  const used = countConditions(sources)
  const atCap = used >= MAX_TOTAL_CONDITIONS

  return (
    <div className="flex flex-col gap-3">
      {sources.map((source, index) => (
        <SourceCard
          key={source.id}
          form={form}
          index={index}
          collectionId={collectionId}
          canRemove={sources.length > 1}
          canAddCondition={!atCap}
          ownsManualPicks={index === manualOwner || manualOwner === -1}
          onRemove={() => setSources(sources.filter((_, i) => i !== index))}
        />
      ))}

      {sources.length < MAX_SOURCES && (
        <button
          type="button"
          onClick={() => setSources([...sources, newSource()])}
          className="flex h-11 items-center justify-center rounded-xl border border-dashed text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
          aria-label={t("sources.addSource")}
        >
          <PlusIcon className="size-4" />
        </button>
      )}

      {used >= BUDGET_NOTICE_FROM && (
        <p
          role="status"
          className={cn(
            "text-center text-xs tabular-nums",
            atCap ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {t("conditions.budget", { used, max: MAX_TOTAL_CONDITIONS })}
        </p>
      )}
    </div>
  )
}
