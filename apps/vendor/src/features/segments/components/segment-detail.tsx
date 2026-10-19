"use client"

import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { GET_SEGMENT_BY_ID } from "@/features/segments/api"
import type { SegmentResponse } from "@/features/segments/types"
import { SegmentEditor } from "./segment-editor"

export function SegmentDetail({ id }: { id: string }) {
  const t = useTranslations("segments.editor")
  const { data } = useSuspenseQuery<SegmentResponse>(GET_SEGMENT_BY_ID, {
    variables: { id },
  })

  const segment = data?.customerSegment?.data
  if (!segment) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {t("notFound")}
      </div>
    )
  }

  return <SegmentEditor mode="edit" segment={segment} />
}
