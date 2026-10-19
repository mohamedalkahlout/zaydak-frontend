"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { CheckIcon, SparklesIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Badge } from "@repo/ui/components/badge"
import { GET_SEGMENT_TEMPLATES } from "@/features/segments/api"
import type {
  SegmentTemplate,
  SegmentTemplateCategory,
  SegmentTemplatesResponse,
} from "@/features/segments/types"
import { TEMPLATE_CATEGORIES } from "@/features/segments/lib/constants"
import { cn } from "@/shared/lib/utils"

interface TemplatesPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (template: SegmentTemplate) => void
  /**
   * Which of the template's own names/descriptions to show — the server
   * sends both. The dialog's copy comes from `segments.templates`.
   */
  locale?: "en" | "ar"
}

export function TemplatesPicker({
  open,
  onOpenChange,
  onApply,
  locale = "en",
}: TemplatesPickerProps) {
  const t = useTranslations("segments.templates")
  const [selectedCategory, setSelectedCategory] =
    useState<SegmentTemplateCategory | "ALL">("ALL")

  const { data } = useQuery<SegmentTemplatesResponse>(GET_SEGMENT_TEMPLATES, {
    skip: !open,
  })

  const allTemplates = data?.segmentTemplates?.templates ?? []
  const templates = useMemo(
    () =>
      selectedCategory === "ALL"
        ? allTemplates
        : allTemplates.filter((tpl) => tpl.category === selectedCategory),
    [allTemplates, selectedCategory],
  )

  // A category the server adds before this app knows it shows as its code
  // rather than as a missing-message key.
  const categoryLabel = (category: string) =>
    t.has(`categories.${category}`) ? t(`categories.${category}`) : category

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            label={t("all")}
            active={selectedCategory === "ALL"}
            onClick={() => setSelectedCategory("ALL")}
          />
          {TEMPLATE_CATEGORIES.map((category) => (
            <CategoryChip
              key={category}
              label={categoryLabel(category)}
              active={selectedCategory === category}
              onClick={() => setSelectedCategory(category)}
            />
          ))}
        </div>

        <div className="grid max-h-[60vh] gap-2 overflow-auto pr-1 sm:grid-cols-2">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onApply(template)
                onOpenChange(false)
              }}
              className="flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-start transition hover:border-primary hover:shadow-sm"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-medium leading-tight">
                  {template.name[locale]}
                </span>
                <Badge variant="secondary" className="font-normal">
                  {categoryLabel(template.category)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {template.description[locale]}
              </p>
              <code className="mt-1 line-clamp-1 w-full rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                {template.query}
              </code>
            </button>
          ))}
          {!templates.length && (
            <p className="col-span-full p-6 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {active && <CheckIcon className="size-3" />}
      {label}
    </button>
  )
}
