"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon, ChevronDownIcon, UsersIcon } from "lucide-react"
import { sileo } from "sileo"
import { useMutation } from "@apollo/client/react"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import type {
  CreateSegmentResponse,
  Segment,
} from "@/features/segments/types"
import { CREATE_SEGMENT, GET_SEGMENTS } from "@/features/segments/api"
import { UseSegmentActions } from "./use-segment-actions"
import { DeleteSegmentDialog } from "./delete-segment-dialog"

/**
 * Top-of-page header that matches Shopify's segment editor:
 *
 *   ←  👥 › New segment           [Duplicate] [More actions ▾] [Use segment ▾]
 *
 * - "Duplicate" creates a new segment with the same query (only enabled in edit mode).
 * - "More actions" wraps Rename / Delete / Export and similar entries.
 * - "Use segment" is the action menu (only meaningful in edit mode).
 */

interface SegmentPageHeaderProps {
  mode: "create" | "edit"
  segment?: Segment
  /** Live query value from the editor — needed for Duplicate. */
  currentQuery: string
  /** Live name value — needed for Duplicate. */
  currentName: string
}

export function SegmentPageHeader({
  mode,
  segment,
  currentQuery,
  currentName,
}: SegmentPageHeaderProps) {
  const t = useTranslations("segments.pageHeader")
  const ts = useTranslations("segments")
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [duplicateSegment, { loading: duplicating }] =
    useMutation<CreateSegmentResponse>(CREATE_SEGMENT, {
      refetchQueries: [
        { query: GET_SEGMENTS, variables: { page: 1, limit: 50 } },
      ],
    })

  const handleDuplicate = async () => {
    if (!segment) return
    const dupName = t("copyName", { name: currentName || segment.name })
    try {
      const { data } = await duplicateSegment({
        variables: {
          input: {
            name: dupName,
            description: segment.description ?? undefined,
            query: currentQuery,
          },
        },
      })
      const newId = data?.createCustomerSegment?.data?.id
      if (newId) {
        sileo.success({ title: t("duplicated"), description: dupName })
        router.push(`/store/${shopSlug}/segments/${newId}`)
      }
    } catch (err) {
      sileo.error({
        title: t("duplicateFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  const isEdit = mode === "edit" && !!segment

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            nativeButton={false}
            render={
              <Link href={`/store/${shopSlug}/segments`} />
            }
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <UsersIcon className="size-4" />
          <Link
            href={`/store/${shopSlug}/segments`}
            className="hover:underline"
          >
            {ts("title")}
          </Link>
          <span>›</span>
          <span className="font-medium text-foreground">
            {isEdit ? segment.name : t("newSegment")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={!isEdit || duplicating || !currentQuery.trim()}
          >
            {duplicating ? t("duplicating") : t("duplicate")}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={(p) => (
                <Button
                  {...p}
                  variant="outline"
                  size="sm"
                  disabled={!isEdit}
                >
                  {t("moreActions")}
                  <ChevronDownIcon className="ml-1 size-3.5" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(currentQuery).then(
                    () => sileo.success({ title: t("queryCopied") }),
                    () => sileo.error({ title: t("copyFailed") }),
                  )
                }}
                disabled={!currentQuery.trim()}
              >
                {t("copyQuery")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={!isEdit}
              >
                {t("deleteSegment")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isEdit && (
            <UseSegmentActions
              segmentId={segment.id}
              shopSlug={shopSlug}
            />
          )}
        </div>
      </div>

      {isEdit && (
        <DeleteSegmentDialog
          segment={segment}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => router.push(`/store/${shopSlug}/segments`)}
        />
      )}
    </>
  )
}
