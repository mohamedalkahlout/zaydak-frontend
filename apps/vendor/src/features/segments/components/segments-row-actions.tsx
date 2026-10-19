"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { CopyIcon, EllipsisIcon, PencilIcon } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import type { Segment } from "@/features/segments/types"
import { segmentQueryText } from "@/features/segments/lib/helpers"
import { DeleteSegmentDialog } from "./delete-segment-dialog"

export function SegmentsRowActions({ segment }: { segment: Segment }) {
  const t = useTranslations("segments.rowActions")
  const tc = useTranslations("common")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryText = segmentQueryText(segment)

  const copyQuery = (value: string) => {
    if (typeof navigator === "undefined") return
    navigator.clipboard.writeText(value).then(
      () => sileo.success({ title: t("queryCopied") }),
      () => sileo.error({ title: t("copyFailed") }),
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(p) => (
            <Button
              {...p}
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("label")}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            render={
              <Link href={`/store/${shopSlug}/segments/${segment.id}`} />
            }
          >
            {tc("edit")}
            <PencilIcon className="ml-auto size-3.5 opacity-60" />
          </DropdownMenuItem>
          {queryText && (
            <DropdownMenuItem onClick={() => copyQuery(queryText)}>
              {t("copyQuery")}
              <CopyIcon className="ml-auto size-3.5 opacity-60" />
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            {tc("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteSegmentDialog
        segment={segment}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
