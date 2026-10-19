"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { ArrowLeftIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent } from "@repo/ui/components/card"
import { Bones } from "@/shared/components/bones"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import { AD_SPENDS, DELETE_AD_SPEND } from "../api/queries"
import type { AdSpend, AdSpendsResponse } from "../types"
import { channelColor } from "../lib/attribution"
import { AdSpendForm } from "./ad-spend-form"

export function AdSpendManager() {
  const t = useTranslations("adSpend")
  const params = useParams<{ shopSlug: string }>()
  const backHref = `/store/${params?.shopSlug ?? ""}/analytics/attribution`

  const [editing, setEditing] = useState<AdSpend | "new" | null>(null)
  const [confirming, setConfirming] = useState<AdSpend | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, loading, refetch } = useQuery<AdSpendsResponse>(AD_SPENDS, {
    fetchPolicy: "cache-and-network",
  })
  const rows = data?.adSpends?.data ?? []
  const currency = rows[0]?.currency ?? "SAR"

  const [deleteAdSpend] = useMutation(DELETE_AD_SPEND, {
    refetchQueries: "active",
  })

  const doDelete = async () => {
    if (!confirming) return
    setDeleting(true)
    try {
      await deleteAdSpend({ variables: { id: confirming.id } })
      sileo.success({ title: t("deleted") })
      setConfirming(null)
    } catch (err) {
      sileo.error({
        title: t("deleteFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <AdSpendForm
        spend={editing === "new" ? undefined : editing}
        defaultCurrency={currency}
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("back")}
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon className="size-4" />
          {t("new")}
        </Button>
      </header>

      <Card>
        <CardContent className="pt-0">
          <Bones name="ad-spend-table" loading={Boolean(loading) && !data}>
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("col.date")}</TableHead>
                  <TableHead>{t("col.channel")}</TableHead>
                  <TableHead>{t("col.source")}</TableHead>
                  <TableHead>{t("col.campaign")}</TableHead>
                  <TableHead className="text-end">{t("col.spend")}</TableHead>
                  <TableHead className="text-end">{t("col.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(row.date)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: channelColor(row.channel) }}
                        />
                        {t(`channels.${row.channel}`)}
                      </span>
                    </TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.campaign ?? "—"}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatMoneyCents(row.normalized_spend_cents, currency)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(row)}
                        >
                          {t("edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setConfirming(row)}
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </Bones>
        </CardContent>
      </Card>

      <Dialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={deleting} />}
            >
              {t("cancel")}
            </DialogClose>
            <Button variant="destructive" onClick={doDelete} disabled={deleting}>
              {deleting ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
