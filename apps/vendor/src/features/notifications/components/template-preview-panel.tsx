"use client"

import { useEffect, useState, useCallback } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react"
import { PREVIEW_NOTIFICATION_TEMPLATE } from "../api"
import type {
  NotificationTemplateEntry,
  PreviewTemplateResult,
} from "../types"

/**
 * The live email preview on the Customize screen (Shopify's template preview
 * with prev/next arrows). Renders the selected template through the back-end —
 * which applies the shop's saved branding — into a sandboxed iframe. `refreshKey`
 * bumps after a branding save so the preview reflects the new logo/colour.
 */
export function TemplatePreviewPanel({
  templates,
  refreshKey,
}: {
  templates: NotificationTemplateEntry[]
  refreshKey: number
}) {
  const t = useTranslations("notifications")
  const [index, setIndex] = useState(0)
  const [preview, { data, loading }] = useMutation<PreviewTemplateResult>(
    PREVIEW_NOTIFICATION_TEMPLATE,
  )

  const current = templates[index]

  const run = useCallback(
    (eventKey: string) => {
      void preview({ variables: { input: { event_key: eventKey } } })
    },
    [preview],
  )

  useEffect(() => {
    if (current) run(current.event_key)
    // Re-run when the selected template changes or branding was saved.
  }, [current?.event_key, refreshKey, run, current])

  if (templates.length === 0) return null

  const html = data?.previewNotificationTemplate.html ?? ""

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="min-w-0 truncate text-sm font-semibold">
          {current ? t(`console.events.${current.event_key}`) : ""}
        </span>
        <div className="flex items-center gap-1">
          {loading && (
            <RefreshCwIcon className="mr-1 size-3.5 animate-spin text-muted-foreground" />
          )}
          <button
            type="button"
            aria-label={t("customize.prev")}
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("customize.next")}
            disabled={index >= templates.length - 1}
            onClick={() =>
              setIndex((i) => Math.min(templates.length - 1, i + 1))
            }
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-b-xl bg-white">
        <iframe
          title={t("console.preview")}
          srcDoc={html}
          sandbox=""
          className="h-160 w-full"
        />
      </div>
    </div>
  )
}
