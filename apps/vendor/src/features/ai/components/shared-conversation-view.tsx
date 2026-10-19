"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { LockIcon, SparklesIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { ShiningText } from "@repo/ui/components/shining-text"
import type {
  AssistantPart,
  VendorAgentConversationDetail,
  VendorAgentToolEvent,
} from "@/features/ai/lib/types"
import { AssistantTurn } from "./assistant-turn"
import { isResumeTurn } from "@/features/ai/lib/resume-marker"
import { sharedConversationCurrency } from "@/features/ai/lib/conversation-currency"
import {
  useSharedConversationLookup,
  useUnlockSharedConversation,
} from "@/features/ai/lib/legacy-share-currency"

interface Props {
  token: string
}

/**
 * Read-only conversation view via share token. Three states the page
 * can show:
 *   1. transcript (status === "ok")
 *   2. PIN-entry form (status === "pin_required")
 *   3. friendly 404 (status === "not_found" or query error)
 */
export function SharedConversationView({ token }: Props) {
  const t = useTranslations("shareConversation")
  // The lookup selects the shop's `currency`; an API built before the field
  // refuses that, and the hook then asks again without it.
  const { lookup, loading, error } = useSharedConversationLookup(token)

  // Unlocked conversation lives in local state once a PIN attempt
  // succeeds, so the page swaps from PIN form to transcript without
  // a full refetch.
  const [unlocked, setUnlocked] =
    useState<VendorAgentConversationDetail | null>(null)

  if (loading) {
    return (
      <div
        className="min-h-svh flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <ShiningText className="text-sm" text={t("loading")} />
      </div>
    )
  }

  const status = lookup?.status ?? (error ? "not_found" : null)

  if (unlocked) {
    return <SharedTranscript convo={unlocked} />
  }

  if (status === "ok" && lookup?.conversation) {
    return <SharedTranscript convo={lookup.conversation} />
  }

  if (status === "pin_required") {
    return (
      <PinGate
        token={token}
        onUnlocked={(convo) => setUnlocked(convo)}
      />
    )
  }

  return <NotFound />
}

// ── PIN gate ─────────────────────────────────────────────

function PinGate({
  token,
  onUnlocked,
}: {
  token: string
  onUnlocked: (convo: VendorAgentConversationDetail) => void
}) {
  const t = useTranslations("shareConversation")
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [unlock, { loading }] = useUnlockSharedConversation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim() || loading) return
    setError(null)
    const conversation = await unlock(token, pin.trim())
    if (conversation) {
      onUnlocked(conversation)
      return
    }
    setError(t("wrongPin"))
    setPin("")
  }

  return (
    <div className="min-h-svh flex items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600">
            <LockIcon className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("body")}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className={cn(error && "border-destructive")}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading || !pin.trim()}>
          {loading ? t("unlocking") : t("unlock")}
        </Button>
      </form>
    </div>
  )
}

// ── 404 / shared not found ───────────────────────────────

function NotFound() {
  const t = useTranslations("shareConversation")
  return (
    <div className="min-h-svh flex flex-col items-center justify-center text-center p-8 gap-3">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <SparklesIcon className="size-5" />
      </div>
      <h1 className="text-xl font-semibold">{t("notAvailable")}</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        {t("notAvailableBody")}
      </p>
    </div>
  )
}

// ── Transcript ───────────────────────────────────────────

/** Named apart from `components/transcript.tsx` — this one is the read-only
 * share page's layout, not the scroll surface the dashboard uses. */
function SharedTranscript({
  convo,
}: {
  convo: VendorAgentConversationDetail
}) {
  // A shared link is read by whoever holds it, and this view rendered every
  // thread as English with USD prices. The viewer's own locale is the right
  // answer for language. Currency is not: it is the shop's, which the share
  // payload names (`currency`, the one shop fact on it). An API built before
  // that field leaves the one the thread's own stats results name, and a
  // thread with none the platform default.
  const t = useTranslations("shareConversation")
  const locale: "ar" | "en" = useLocale() === "ar" ? "ar" : "en"
  const currency = sharedConversationCurrency(convo)
  return (
    <div className="min-h-svh bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <header className="border-b pb-4 flex items-center gap-3">
          <div className="size-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <SparklesIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {convo.title ?? t("untitled")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("readOnly")}</p>
          </div>
        </header>

        <div className="space-y-4">
          {convo.messages.map((m) =>
            m.role === "user" && isResumeTurn(m.content) ? null : (
              <SharedBubble
                key={m.id}
                role={m.role}
                content={m.content}
                tool_events={m.tool_events ?? null}
                parts={m.parts ?? null}
                currency={currency}
                locale={locale}
              />
            ),
          )}
        </div>

        <footer className="pt-6 border-t text-center text-xs text-muted-foreground">
          {t("generatedBy")}
        </footer>
      </div>
    </div>
  )
}

function SharedBubble({
  role,
  content,
  tool_events,
  parts,
  currency,
  locale,
}: {
  role: "user" | "assistant"
  content: string
  tool_events: VendorAgentToolEvent[] | null
  parts: AssistantPart[] | null
  /** A shared link is read by whoever holds it, so both of these come from
   * the viewer and the share payload — never a hardcoded "USD"/"en", which
   * is what an Arabic vendor's shared thread used to render as. */
  currency: string
  locale: "ar" | "en"
}) {
  const isUser = role === "user"
  const clean = content.replace(/\n*\[Attached images:[^\]]+\]\s*$/u, "")

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] sm:max-w-[85%] text-end">
          {clean && (
            <div className="inline-block px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap bg-primary text-primary-foreground">
              {clean}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] sm:max-w-[85%]">
        <AssistantTurn
          parts={parts ?? undefined}
          content={clean}
          toolEvents={tool_events ?? undefined}
          currency={currency}
          locale={locale}
        />
      </div>
    </div>
  )
}
