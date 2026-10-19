"use client"

import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import {
  DELETE_TARGET,
  GET_TARGETS,
  TargetGaugeCard,
  type Target,
  type TargetsResponse,
} from "@/features/targets"

/**
 * The shop's targets rendered as gauge cards inside the analytics overview
 * (Shopify-style: goals live on the analytics page, not only on their own
 * subpage). Renders nothing while there are no targets — the header's
 * Targets menu is the entry point.
 */
export function AnalyticsTargetsSection({
  onEdit,
}: {
  onEdit: (target: Target) => void
}) {
  const t = useTranslations("analytics")
  const tt = useTranslations("targets")

  const { data } = useQuery<TargetsResponse>(GET_TARGETS, {
    fetchPolicy: "cache-and-network",
  })
  const targets = data?.targets?.data ?? []

  // Refetch only the targets list — "active" would also re-run the heavy
  // analytics aggregation queries on this page.
  const [deleteTarget] = useMutation(DELETE_TARGET, {
    refetchQueries: [{ query: GET_TARGETS }],
  })

  const onDelete = async (target: Target) => {
    try {
      await deleteTarget({ variables: { id: target.id } })
      sileo.success({ title: tt("deleted") })
    } catch (err) {
      sileo.error({
        title: tt("deleteFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  if (targets.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-sm font-semibold text-muted-foreground">
        {t("targets.title")}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {targets.map((target) => (
          <TargetGaugeCard
            key={target.id}
            target={target}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  )
}
