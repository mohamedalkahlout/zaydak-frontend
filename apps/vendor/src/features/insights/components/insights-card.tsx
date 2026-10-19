"use client"

import { useMutation, useQuery } from "@apollo/client/react"
import {
  AlertTriangleIcon,
  LightbulbIcon,
  SparklesIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"
import {
  DISMISS_INSIGHT,
  GET_INSIGHTS,
  type AiInsight,
  type DismissInsightResponse,
  type InsightsResponse,
} from "@/features/insights"

/** Pick the current-locale string from a `{ en, ar }` map, falling back. */
function pick(map: Record<string, string>, locale: string): string {
  return map[locale] ?? map.en ?? map.ar ?? Object.values(map)[0] ?? ""
}

// Severity → icon + accent. recharts isn't involved; these are Tailwind text
// colours that read in both themes.
const SEVERITY = {
  critical: { Icon: AlertTriangleIcon, tone: "text-red-600 dark:text-red-400" },
  warning: { Icon: AlertTriangleIcon, tone: "text-amber-600 dark:text-amber-400" },
  opportunity: { Icon: TrendingUpIcon, tone: "text-emerald-600 dark:text-emerald-400" },
  info: { Icon: LightbulbIcon, tone: "text-sky-600 dark:text-sky-400" },
} as const

function severityStyle(severity: string) {
  return SEVERITY[severity as keyof typeof SEVERITY] ?? SEVERITY.info
}

/**
 * Proactive AI insights on the analytics overview (Shopify-style "here's what
 * changed"). Renders nothing when there are no active insights, so it only
 * appears once the detector engine has written something for the shop.
 */
export function InsightsCard() {
  const t = useTranslations("analytics")
  const locale = useLocale()

  const { data } = useQuery<InsightsResponse>(GET_INSIGHTS, {
    variables: { limit: 5 },
    fetchPolicy: "cache-and-network",
  })
  const insights = data?.insights?.data ?? []

  // Refetch only the insights list, never "active" (that would re-run the heavy
  // analytics aggregation queries sharing this page).
  const [dismiss] = useMutation<DismissInsightResponse>(DISMISS_INSIGHT, {
    refetchQueries: [{ query: GET_INSIGHTS, variables: { limit: 5 } }],
  })

  const onDismiss = async (insight: AiInsight) => {
    try {
      await dismiss({ variables: { id: insight.id } })
    } catch (err) {
      sileo.error({
        title: t("insights.dismissFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  if (insights.length === 0) return null

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center gap-2">
        <SparklesIcon className="size-4 text-primary" />
        <CardTitle>{t("insights.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {insights.map((insight) => {
          const { Icon, tone } = severityStyle(insight.severity)
          return (
            <div
              key={insight.id}
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {pick(insight.title, locale)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pick(insight.body, locale)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground"
                aria-label={t("insights.dismiss")}
                onClick={() => onDismiss(insight)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
