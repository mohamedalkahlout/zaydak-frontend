"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent } from "@repo/ui/components/card"
import { Bones } from "@/shared/components/bones"
import { DELETE_TARGET, GET_TARGETS } from "../api/queries"
import type { Target, TargetsResponse } from "../types"
import { TargetGaugeCard } from "./target-gauge-card"
import { TargetForm } from "./target-form"

export function TargetsPage() {
  const t = useTranslations("targets")
  const [editing, setEditing] = useState<Target | "new" | null>(null)

  const { data, loading, refetch } = useQuery<TargetsResponse>(GET_TARGETS, {
    fetchPolicy: "cache-and-network",
  })
  const targets = data?.targets?.data ?? []

  const [deleteTarget] = useMutation(DELETE_TARGET, {
    refetchQueries: [{ query: GET_TARGETS }],
  })

  const onDelete = async (target: Target) => {
    try {
      await deleteTarget({ variables: { id: target.id } })
      sileo.success({ title: t("deleted") })
    } catch (err) {
      sileo.error({
        title: t("deleteFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  if (editing) {
    return (
      <TargetForm
        target={editing === "new" ? undefined : editing}
        onDone={() => {
          setEditing(null)
          void refetch()
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon className="size-4" />
          {t("new")}
        </Button>
      </header>

      <Bones name="targets-grid" loading={Boolean(loading) && !data}>
        {targets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
              <Button variant="outline" onClick={() => setEditing("new")}>
                <PlusIcon className="size-4" />
                {t("new")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {targets.map((target) => (
              <TargetGaugeCard
                key={target.id}
                target={target}
                onEdit={setEditing}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </Bones>
    </div>
  )
}
