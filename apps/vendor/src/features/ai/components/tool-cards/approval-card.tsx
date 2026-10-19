"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Check, ShieldAlert, X } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import type {
  AgentApprovalDecision,
  AgentApprovalRequest,
} from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  requests: AgentApprovalRequest[]
  /** Empty while the run is still paused; populated once answered. */
  decisions: AgentApprovalDecision[]
  /** Absent on historical turns — a resolved card is read-only. */
  onDecide?: (decisions: AgentApprovalDecision[]) => void
  busy?: boolean
}

/**
 * The approval gate, as the vendor sees it.
 *
 * Two design rules, both load-bearing rather than cosmetic:
 *
 *  1. The blast radius leads. When the server managed a real dry run, the
 *     count is the headline — "247 products" is the fact that makes this a
 *     decision instead of a formality. Without one we say so plainly rather
 *     than restating the request back at the vendor as if it were a preview.
 *  2. Reject is the resting state. Approve is the deliberate button; nothing
 *     is pre-selected and there is no default action on Enter, because the
 *     whole point of the pause is that it is not automatic.
 *
 * Once decided, the card stops being interactive and becomes the record of
 * what was authorized — it persists in the turn's work log, so reopening the
 * thread later shows who approved what rather than an unexplained bulk edit.
 */
export function ApprovalCard({
  requests,
  decisions,
  onDecide,
  busy = false,
}: Props) {
  const t = useTranslations("aiChat.approval")
  const [submitted, setSubmitted] = useState(false)

  const resolved = decisions.length > 0
  const pending = !resolved && !!onDecide
  const disabled = busy || submitted

  const decide = (approved: boolean) => {
    if (disabled || !onDecide) return
    setSubmitted(true)
    onDecide(requests.map((r) => ({ id: r.id, approved })))
  }

  return (
    <ResultCardShell
      icon={ShieldAlert}
      title={t("title")}
      accent="amber"
      trailing={
        resolved
          ? decisions.some((d) => d.approved)
            ? t("approved")
            : t("rejected")
          : undefined
      }
    >
      <div className="space-y-3">
        <ul className="space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="text-sm">
              <p className="font-medium">{toolLabel(t, request.tool)}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {effectLine(t, request)}
              </p>
            </li>
          ))}
        </ul>

        {pending && (
          <>
            <p className="text-xs text-muted-foreground">{t("prompt")}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                disabled={disabled}
                onClick={() => decide(true)}
              >
                <Check className="size-3.5" />
                {t("approve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => decide(false)}
              >
                <X className="size-3.5" />
                {t("reject")}
              </Button>
            </div>
          </>
        )}

        {!pending && !resolved && (
          // Persisted mid-approval but no handler wired — a shared/read-only
          // view of the thread. Say the run is waiting rather than render
          // buttons that would do nothing.
          <p className="text-xs text-muted-foreground">{t("waiting")}</p>
        )}
      </div>
    </ResultCardShell>
  )
}

type Translate = ReturnType<typeof useTranslations<"aiChat.approval">>

/** Tool name → vendor-readable label, with the raw name as a safe fallback so
 * a newly gated tool never renders as blank. */
function toolLabel(t: Translate, tool: string): string {
  const key = `tools.${tool}` as Parameters<Translate>[0]
  const label = t(key)
  return label === `aiChat.approval.${key}` ? tool : label
}

/**
 * One line describing what running this would do.
 *
 * Prefers the server's dry run. `affected` is the count bulk tools report;
 * anything else falls back to a generic "this cannot be previewed" so we
 * never imply a number we did not compute.
 */
function effectLine(t: Translate, request: AgentApprovalRequest): string {
  const affected = request.facts.affected
  if (request.previewed && typeof affected === "number") {
    return t("affected", { count: affected })
  }
  if (request.previewed && request.facts.ok === false) {
    const error = request.facts.error
    return typeof error === "string" ? error : t("previewFailed")
  }
  return t("noPreview")
}
