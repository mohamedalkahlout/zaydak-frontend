"use client"

import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_MY_AI_SPENDERS } from "../api/queries"
import type { AiSpenders } from "../types"

/**
 * Who is spending the shop's customer-AI allowance.
 *
 * **The companion to the meter above it, and the reason it is worth a section
 * of its own.** Every answered turn is one request off `ai.agent.customer`
 * whatever the customer typed, so a merchant staring at an exhausted meter
 * wants a name rather than a total — and until this existed the only answer
 * available was the total.
 *
 * Three things about it are deliberate.
 *
 * **It runs its own query with no window arguments.** The rest of this screen
 * is a rolling 7/30/90 days; this is the *entitlement period*, the one the
 * meters reset on. Handing it the screen's `from` would make two numbers in one
 * column disagree permanently with no explanation available to anybody.
 *
 * **It renders the remainder.** `unattributed_turns` covers spend from before
 * attribution shipped, visitors whose thread has since been deleted, and the
 * tail past the server's row cap. Dropping the line would present the list as
 * though it summed to the meter, which is a claim we cannot support and which
 * the first merchant to add the column up would catch.
 *
 * **It never masks anything itself.** `label` arrives masked from the API,
 * which is where this app masks — the same contract `phone_masked` keeps on the
 * inbox thread. A masker here would be a second answer to one question.
 */
export function AiSpendersCard() {
  const t = useTranslations("plan")
  const { data, loading } = useQuery<{
    myAiSpenders: { success: boolean; data: AiSpenders | null }
  }>(GET_MY_AI_SPENDERS, { fetchPolicy: "cache-and-network" })

  const spenders = data?.myAiSpenders.data ?? null

  // Not metered at all — no entitlement row for the capability. Rendering an
  // empty breakdown here would say "nobody spent anything", which is a
  // different and untrue claim.
  if (!loading && !spenders) return null

  const rows = spenders?.rows ?? []
  const hasNothing =
    !loading && rows.length === 0 && (spenders?.unattributed_turns ?? 0) === 0

  return (
    <section className="rounded-xl border bg-card">
      <header className="border-b px-5 py-3">
        <h2 className="font-medium">{t("spenders.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("spenders.hint")}</p>
      </header>

      <div className="px-5 py-3">
        {loading && rows.length === 0 ? (
          // Gated on having no rows so changing nothing does not flash the
          // skeleton back over a list that is already on screen.
          <div aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="my-2 h-8 w-full" />
            ))}
          </div>
        ) : hasNothing ? (
          <p className="py-3 text-sm text-muted-foreground">
            {t("spenders.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {row.label ?? t(`spenders.channel.${row.channel}`)}
                  </span>
                  {row.label ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {t(`spenders.channel.${row.channel}`)}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {t("callCount", { count: row.turns })}
                </span>
              </div>
            ))}

            {spenders && spenders.unattributed_turns > 0 ? (
              /**
               * Visibly a different kind of row, because it is not a customer.
               * Reading it as one enormous spender is the exact
               * misunderstanding the line exists to prevent.
               */
              <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2 text-sm text-muted-foreground">
                <span className="min-w-0 truncate">
                  {t("spenders.unattributed")}
                </span>
                <span className="shrink-0 tabular-nums">
                  {t("callCount", { count: spenders.unattributed_turns })}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
