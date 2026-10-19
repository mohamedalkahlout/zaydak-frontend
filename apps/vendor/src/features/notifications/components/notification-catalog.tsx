"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronRightIcon, ChevronUpIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { CATEGORY_ORDER } from "../lib/notify-catalog"
import type { NotificationTemplateEntry } from "../types"

/**
 * The Shopify "Customer notifications" list: templates grouped under collapsible
 * category headers, each row showing its name, a one-line description, and a
 * Customized/Off badge. Clicking a row opens its editor.
 */
export function NotificationCatalog({
  templates,
  onSelect,
}: {
  templates: NotificationTemplateEntry[]
  onSelect: (eventKey: string) => void
}) {
  const t = useTranslations("notifications")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggle(category: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const byCategory = new Map<string, NotificationTemplateEntry[]>()
  for (const tpl of templates) {
    const list = byCategory.get(tpl.category) ?? []
    list.push(tpl)
    byCategory.set(tpl.category, list)
  }
  const categories = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter(
      (c) => !CATEGORY_ORDER.includes(c as never),
    ),
  ]

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {categories.map((category) => {
        const rows = byCategory.get(category) ?? []
        const isCollapsed = collapsed.has(category)
        return (
          <div key={category} className="border-b border-border last:border-b-0">
            {/* Category header — collapsible */}
            <button
              type="button"
              onClick={() => toggle(category)}
              className="flex w-full items-center justify-between gap-2 bg-muted/50 px-4 py-2.5 text-start transition-colors hover:bg-muted"
            >
              <span className="text-sm font-semibold">
                {t(`console.categories.${category}`)}
              </span>
              <ChevronUpIcon
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  isCollapsed && "rotate-180",
                )}
              />
            </button>

            {!isCollapsed && (
              <ul className="divide-y divide-border">
                {rows.map((tpl) => (
                  <li key={tpl.event_key}>
                    <button
                      type="button"
                      onClick={() => onSelect(tpl.event_key)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/30"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              !tpl.enabled && "text-muted-foreground",
                            )}
                          >
                            {t(`console.events.${tpl.event_key}`)}
                          </span>
                          {tpl.is_customized && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              {t("console.customized")}
                            </span>
                          )}
                          {!tpl.enabled && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("console.off")}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(`console.eventDesc.${tpl.event_key}`)}
                        </span>
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
