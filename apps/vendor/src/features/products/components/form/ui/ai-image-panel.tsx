"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { SparklesIcon, Loader2Icon, AlertCircleIcon, CheckIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { Label } from "@repo/ui/components/label"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/components/dialog"
import { cn } from "@/shared/lib/utils"
import { isAiQuotaError } from "@/shared/lib/ai-image-errors"
import { getValidationErrors } from "@/shared/lib/auth/graphql-errors"
import { useAiImageQuota } from "@/features/plan/lib/use-feature"
import {
  GENERATE_PRODUCT_IMAGE,
  GET_AI_IMAGE_GENERATION,
  SELECT_AI_IMAGE_RESULTS,
  isTerminal,
  type AiImageGeneration,
  type AiImageResult,
  type ImageGenMode,
  type GenerateImageResponse,
  type AiImageGenerationResponse,
} from "@/features/products/api/ai-image"

/** Media items that already carry an attachment id — usable as a reference. */
export interface ReferenceOption {
  id: string
  thumbnail: string
}

const ASPECTS = ["1:1", "4:5", "3:2", "16:9", "9:16"] as const
const COUNTS = [1, 2, 3, 4] as const
const POLL_MS = 2500
/** ~2.5 minutes of polling, matching `use-enhance-file`'s cap. */
const MAX_POLLS = 60
/** The server's `CAPTION_MAX_CHARS`; it cuts anything longer. */
const CAPTION_MAX = 280

type ModeOption = {
  value: ImageGenMode
  labelKey: string
  needsRef: boolean
  /**
   * Whether the caption field is offered. A cut-out or an upscale is a
   * utility transform of an image the vendor already has, and a line of text
   * drawn across it would spoil the one thing it was asked for.
   */
  takesCaption: boolean
}
const MODES: ModeOption[] = [
  { value: "TEXT_TO_IMAGE", labelKey: "modeText", needsRef: false, takesCaption: true },
  { value: "EDIT", labelKey: "modeEdit", needsRef: true, takesCaption: true },
  { value: "BACKGROUND_REMOVE", labelKey: "modeBgRemove", needsRef: true, takesCaption: false },
  { value: "UPSCALE", labelKey: "modeUpscale", needsRef: true, takesCaption: false },
]

export function AiImagePanel({
  open,
  onOpenChange,
  onAdd,
  referenceOptions,
  productId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (media: { id: string; original: string; thumbnail: string }[]) => void
  referenceOptions: ReferenceOption[]
  productId?: string
}) {
  const t = useTranslations("aiImage")
  const quota = useAiImageQuota()
  const client = useApolloClient()
  const [generate] = useMutation<GenerateImageResponse>(GENERATE_PRODUCT_IMAGE)
  const [selectResults] = useMutation(SELECT_AI_IMAGE_RESULTS)

  const [prompt, setPrompt] = useState("")
  const [caption, setCaption] = useState("")
  const [mode, setMode] = useState<ImageGenMode>("TEXT_TO_IMAGE")
  const [count, setCount] = useState<number>(2)
  const [aspect, setAspect] = useState<string>("1:1")
  const [referenceId, setReferenceId] = useState<string | undefined>()

  const [status, setStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [results, setResults] = useState<AiImageResult[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [genId, setGenId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const activeMode = MODES.find((m) => m.value === mode)!
  const needsRef = activeMode.needsRef
  const sentCaption = activeMode.takesCaption ? caption.trim() : ""
  const hasRef = referenceOptions.length > 0
  const canGenerate =
    prompt.trim().length >= 3 &&
    status !== "running" &&
    (!needsRef || !!referenceId)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Reset transient state when the dialog closes. Adjusted during render
  // rather than from an effect: React re-runs this component immediately with
  // the panel blank, where an effect would first commit a frame still showing
  // the previous run's generated images.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setStatus("idle")
      setResults([])
      setPicked(new Set())
      setGenId(null)
      setErrorMsg(null)
    }
  }

  // The poll loop is an external system, so tearing it down stays in an
  // effect. It deliberately did NOT move up with the state reset: a
  // render-phase `clearInterval` would end a poll that React then discards
  // the render of, and nothing would restart it.
  useEffect(() => {
    if (!open) stopPolling()
  }, [open, stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const applyGeneration = useCallback(
    (g: AiImageGeneration) => {
      if (!isTerminal(g.status)) return false
      stopPolling()
      if (g.status === "SUCCEEDED" && g.results.length) {
        setResults(g.results)
        // Pre-pick everything so a one-click "add all" is the default path.
        setPicked(new Set(g.results.map((r) => r.id)))
        setStatus("done")
      } else if (g.status === "MODERATED_OUT") {
        setErrorMsg(t("moderatedOut"))
        setStatus("error")
      } else {
        setErrorMsg(g.error ?? t("failed"))
        setStatus("error")
      }
      return true
    },
    [stopPolling, t],
  )

  const poll = useCallback(
    (id: string) => {
      // Bounded, so a lost webhook can't spin forever — this used to be an
      // uncapped interval, 1,440 network-only requests an hour on a stranded
      // row. Same cap as the enhance hook next door; the reconcile sweep on
      // the back-end is what eventually settles the row itself.
      let ticks = 0
      pollRef.current = setInterval(async () => {
        if (++ticks > MAX_POLLS) {
          stopPolling()
          setErrorMsg(t("failed"))
          setStatus("error")
          return
        }
        try {
          const { data } = await client.query<AiImageGenerationResponse>({
            query: GET_AI_IMAGE_GENERATION,
            variables: { id },
            fetchPolicy: "network-only",
          })
          const g = data?.aiImageGeneration?.data
          if (g) applyGeneration(g)
        } catch {
          stopPolling()
          setErrorMsg(t("failed"))
          setStatus("error")
        }
      }, POLL_MS)
    },
    [client, applyGeneration, stopPolling, t],
  )

  const onGenerate = async () => {
    setStatus("running")
    setErrorMsg(null)
    setResults([])
    setPicked(new Set())
    try {
      const { data } = await generate({
        variables: {
          input: {
            prompt: prompt.trim(),
            mode,
            count,
            aspectRatio: aspect,
            referenceAttachmentIds:
              needsRef && referenceId ? [referenceId] : undefined,
            productId,
            caption: sentCaption || undefined,
          },
        },
      })
      const g = data?.generateProductImage?.data
      if (!g) {
        setErrorMsg(t("failed"))
        setStatus("error")
        return
      }
      setGenId(g.id)
      if (!applyGeneration(g)) poll(g.id)
    } catch (err) {
      // Surface budget/quota rejections with a clear message. The code is in
      // extensions.validation_errors — err.message is always 'Validation failed'.
      // A refused caption shares the prompt's code and names its field: the
      // caption is the line the vendor typed to be printed, so say it was that.
      const first = getValidationErrors(err)[0]
      setErrorMsg(
        first?.field === "caption" && first.code === "AI_IMAGE_PROMPT_REJECTED"
          ? t("captionRejected")
          : isAiQuotaError(err)
            ? t("quotaExhausted")
            : t("failed"),
      )
      setStatus("error")
    }
  }

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addToMedia = async () => {
    const chosen = results.filter((r) => picked.has(r.id))
    if (!chosen.length) return
    // Persist the selection server-side (best-effort), then stage into media.
    if (genId) {
      void selectResults({
        variables: { generationId: genId, resultIds: chosen.map((r) => r.id) },
      }).catch(() => {})
    }
    onAdd(
      chosen.map((r) => ({
        id: r.attachment_id,
        original: r.url,
        thumbnail: r.thumbnail ?? r.url,
      })),
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-violet-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Mode pills */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("mode")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => {
                const disabled = m.needsRef && !hasRef
                return (
                  <button
                    key={m.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setMode(m.value)
                      if (m.needsRef && !referenceId && referenceOptions[0])
                        setReferenceId(referenceOptions[0].id)
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      mode === m.value
                        ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                        : "border-input text-muted-foreground hover:text-foreground",
                      disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {t(m.labelKey)}
                  </button>
                )
              })}
            </div>
            {needsRef && !hasRef && (
              <p className="text-xs text-muted-foreground">{t("needReference")}</p>
            )}
          </div>

          {/* Reference picker (edit modes) */}
          {needsRef && hasRef && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("referenceLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {referenceOptions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReferenceId(r.id)}
                    className={cn(
                      "size-14 overflow-hidden rounded-md border-2 transition-colors",
                      referenceId === r.id
                        ? "border-violet-500"
                        : "border-transparent hover:border-input",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prompt */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-prompt">{t("promptLabel")}</Label>
            <Textarea
              id="ai-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("promptPlaceholder")}
            />
          </div>

          {/* Caption: drawn onto each finished image by the server, never sent
              to the model, which cannot letter Arabic. Kept in state while a
              transform mode hides it, and not sent from one. */}
          {activeMode.takesCaption && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-caption">{t("captionLabel")}</Label>
              <Input
                id="ai-caption"
                value={caption}
                maxLength={CAPTION_MAX}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t("captionPlaceholder")}
                aria-describedby="ai-caption-hint"
              />
              <p id="ai-caption-hint" className="text-xs text-muted-foreground">
                {t("captionHint")}
              </p>
            </div>
          )}

          {/* Count + aspect (hidden for single-output transform modes) */}
          {mode === "TEXT_TO_IMAGE" && (
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col gap-1.5">
                <Label>{t("count")}</Label>
                <div className="flex gap-1.5">
                  {COUNTS.map((c) => (
                    <PillNum
                      key={c}
                      active={count === c}
                      onClick={() => setCount(c)}
                    >
                      {c}
                    </PillNum>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("aspectRatio")}</Label>
                <div className="flex gap-1.5">
                  {ASPECTS.map((a) => (
                    <PillNum
                      key={a}
                      active={aspect === a}
                      onClick={() => setAspect(a)}
                    >
                      {a}
                    </PillNum>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* The negative-prompt field was removed on 2026-07-27. It was
              plumbed the whole way to `CreatePredictionInput` and then dropped:
              no model's `buildInput` ever forwarded it, so everything typed
              here was discarded silently. FLUX.2 Pro supports no negative
              prompt at all, so honouring the field would have meant adding a
              different model rather than mapping a value. */}

          {/* Results area */}
          <ResultsArea
            status={status}
            count={count}
            results={results}
            picked={picked}
            onToggle={togglePick}
            errorMsg={errorMsg}
            emptyText={t("empty")}
            pickToAdd={t("pickToAdd")}
          />

          {/*
            The remaining count, not just "uses AI credits". A panel that says
            an action costs something without saying how much is left leaves the
            vendor to discover the cap by hitting it — the exact failure the
            Studio rail already avoids. Reads the shared entitlement seam, so it
            follows the shop's plan rather than a bespoke query.
          */}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SparklesIcon className="size-3" />
            {quota.remaining === null
              ? t("creditsNote")
              : quota.remaining === 0
                ? t("quotaNone")
                : t("quotaLeft", { count: quota.remaining })}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={status === "done" ? "outline" : "default"}
              disabled={!canGenerate}
              onClick={onGenerate}
            >
              {status === "running" ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  {t("generating")}
                </>
              ) : status === "done" ? (
                t("regenerate")
              ) : (
                <>
                  <SparklesIcon className="size-4" />
                  {t("generate")}
                </>
              )}
            </Button>
            {status === "done" && (
              <Button
                type="button"
                size="sm"
                disabled={picked.size === 0}
                onClick={addToMedia}
              >
                {t("addSelected", { count: picked.size })}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PillNum({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-9 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
          : "border-input text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function ResultsArea({
  status,
  count,
  results,
  picked,
  onToggle,
  errorMsg,
  emptyText,
  pickToAdd,
}: {
  status: "idle" | "running" | "done" | "error"
  count: number
  results: AiImageResult[]
  picked: Set<string>
  onToggle: (id: string) => void
  errorMsg: string | null
  emptyText: string
  pickToAdd: string
}) {
  if (status === "error") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
        <span>{errorMsg}</span>
      </div>
    )
  }
  if (status === "running") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    )
  }
  if (status === "done") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{pickToAdd}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {results.map((r) => {
            const isPicked = picked.has(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onToggle(r.id)}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-lg border bg-muted/40 transition-shadow",
                  isPicked && "ring-2 ring-violet-500 ring-offset-1",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.thumbnail ?? r.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {isPicked && (
                  <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-violet-500 text-white shadow">
                    <CheckIcon className="size-3.5" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
      {emptyText}
    </div>
  )
}
