"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useApolloClient } from "@apollo/client/react"
import { SparklesIcon, Loader2Icon, AlertCircleIcon } from "lucide-react"
import { Skeleton } from "@repo/ui/components/skeleton"
import { ShiningText } from "@repo/ui/components/shining-text"
import {
  GET_AI_IMAGE_GENERATION,
  isTerminal,
  type AiImageGeneration,
  type AiImageResult,
  type AiImageGenerationResponse,
} from "@/features/products/api/ai-image"
import { ResultCardShell } from "./result-card-shell"

/** Shape returned by the `generate_product_image` agent tool. */
export interface AiImageGenerationToolResult {
  ok: boolean
  generation_id: string
  status: string
  prompt: string
  count?: number
  mode?: string
}

const POLL_MS = 2500

/**
 * Renders a `generate_product_image` tool result. The tool only enqueues the
 * generation, so this card polls `aiImageGeneration` to completion and shows
 * the finished tiles inline in the work log. Winners are added to a product in
 * the product media panel (the agent never writes the product directly).
 */
export function AiImageGenerationCard({
  result,
}: {
  result: AiImageGenerationToolResult
}) {
  const t = useTranslations("aiChat.toolCards.aiImage")
  const client = useApolloClient()
  const [gen, setGen] = useState<AiImageGeneration | null>(null)
  const [failed, setFailed] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const id = result.generation_id
    if (!id) return
    let cancelled = false

    const check = async () => {
      try {
        const { data } = await client.query<AiImageGenerationResponse>({
          query: GET_AI_IMAGE_GENERATION,
          variables: { id },
          fetchPolicy: "network-only",
        })
        const g = data?.aiImageGeneration?.data
        if (cancelled || !g) return
        setGen(g)
        if (isTerminal(g.status) && pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch {
        if (cancelled) return
        setFailed(true)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }

    void check()
    pollRef.current = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [client, result.generation_id])

  const count = gen?.results.length || result.count || 2
  const status = gen?.status ?? "QUEUED"
  const running = !gen || !isTerminal(status)

  return (
    <ResultCardShell icon={SparklesIcon} title={t("title")} accent="violet">
      <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
        “{result.prompt}”
      </p>

      {failed || status === "FAILED" ? (
        <Message icon text={t("failed")} />
      ) : status === "MODERATED_OUT" ? (
        <Message icon text={t("moderated")} />
      ) : running ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(gen?.results ?? []).map((r: AiImageResult) => (
              <div
                key={r.id}
                className="aspect-square overflow-hidden rounded-lg border bg-muted/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.thumbnail ?? r.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("addHint")}
          </p>
        </>
      )}

      {running && !failed && (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs"
          role="status"
          aria-live="polite"
        >
          <Loader2Icon className="size-3 animate-spin text-muted-foreground motion-reduce:animate-none" />
          <ShiningText className="text-xs" text={t("generating")} />
        </p>
      )}
    </ResultCardShell>
  )
}

function Message({ icon, text }: { icon?: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      {icon && (
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      )}
      <span>{text}</span>
    </div>
  )
}
