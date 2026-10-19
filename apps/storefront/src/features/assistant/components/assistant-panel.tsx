"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { AnimatePresence, m } from "motion/react"
import {
  ArrowUp,
  History,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import { useShop } from "@/features/shop/shop-context"
import { useAssistant } from "../use-assistant"
import { useAssistantStore } from "../store"
import { failureLabel } from "../lib/refusal"
import { AssistantProducts } from "./assistant-products"
import { AssistantAdded } from "./assistant-added"
import { AssistantNegotiationCta } from "./assistant-negotiation-cta"

/** Openers, shown only on an empty panel — a prompt, not a menu. */
const STARTER_KEYS = ["starterOrder", "starterMatch", "starterNegotiate"] as const

/**
 * The tools worth naming while the shopper waits.
 *
 * **An allow-list, not a lookup with a fallback**, and that is the point: a tool
 * added six months from now is silent here rather than captioning the panel
 * with its own internal name. The assistant reaches a dozen tools and most of
 * them — reading a return policy, checking a coupon — finish in milliseconds
 * and would flash a caption nobody can read.
 *
 * `search_products` is the one that earns it. It is where the seconds go, it
 * runs several times in a turn for anything shaped like "put an outfit
 * together", and its argument is a word the shopper recognises as their own
 * question. `negotiate_price` is the same class when a deal is in flight.
 */
const PHASE_LABELS: Record<
  string,
  "phaseSearching" | "phaseCart" | "phaseNegotiate"
> = {
  search_products: "phaseSearching",
  add_to_cart: "phaseCart",
  negotiate_price: "phaseNegotiate",
}

/**
 * The caption under way, or null when there is nothing worth saying.
 *
 * Null is a real answer here, not a gap to fill: the mutation fallback reports
 * no progress at all, and inventing "Working…" for it would be a caption that
 * describes nothing.
 */
function phaseLabel(
  phase: { name: string; query?: string } | null | undefined,
  t: ReturnType<typeof useTranslations<"assistant">>,
): string | null {
  if (!phase) return null
  const key = PHASE_LABELS[phase.name]
  if (!key) return null
  // The shopper's own word, when the tool had one — "Searching for jackets"
  // rather than "Searching". Trimmed because it goes on one line in a panel.
  return phase.query && key !== "phaseNegotiate"
    ? t(`${key}Query`, { query: phase.query.slice(0, 40) })
    : t(key)
}

/**
 * The shop's assistant, in a panel over the shop.
 *
 * **An overlay rather than a route**, and that is the point: somebody asking
 * "what goes with this" is looking at a product, and navigating them away to
 * ask is the failure. Closing it returns them exactly where they were.
 *
 * ## The header carries three controls, and each earns its place
 *
 * **History** is the only one that needed something built behind it. Nothing is
 * stored server-side, so "history" means this tab: a shopper who asks about a
 * jacket, then starts again about shoes, can get the jacket back. It doubles as
 * the way to start fresh, which is the more common intent — so the list opens
 * with "New conversation" above it rather than hiding that under another icon.
 *
 * **Expand** grows the card for a long answer that has outgrown a corner. A
 * fourth control docked the panel to a full-height rail and was removed on the
 * merchant's own reading: a storefront assistant is consulted beside the page,
 * not given a column of it.
 *
 * **Minimise** closes. Named that rather than "close" because the transcript
 * survives it, which is the promise the icon makes.
 */
export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("assistant")
  const { shop, slug } = useShop()
  const { messages, pending, phase, preview, send } = useAssistant()

  const mode = useAssistantStore((s) => s.mode)
  const setMode = useAssistantStore((s) => s.setMode)
  const history = useAssistantStore((s) => s.history)
  const startNew = useAssistantStore((s) => s.startNew)
  const restore = useAssistantStore((s) => s.restore)

  const [draft, setDraft] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  const scroller = useRef<HTMLDivElement>(null)

  // Only the newest Accept CTA per negotiation session — older counters for
  // the same session_id must not stack identical offer cards in the transcript.
  const latestNegCtaMessageId = useMemo(() => {
    const bySession = new Map<string, string>()
    for (const m of messages) {
      if (m.role !== "assistant" || !m.negotiationOffers?.length) continue
      for (const offer of m.negotiationOffers) {
        bySession.set(offer.session_id, m.id)
      }
    }
    return bySession
  }, [messages])

  // PDP "Negotiate" (and similar) open this panel with a first customer turn.
  // Mount-only: the prompt is consumed once so a remount mid-chat does not
  // re-send. Intentional effect — the send is async and cannot run in render.
  useEffect(() => {
    const prompt = useAssistantStore.getState().consumePendingPrompt()
    if (!prompt) return
    void send(prompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on open
  }, [])

  // Follow the conversation as it grows. `messages.length` rather than the
  // array: a new turn is the only thing that should move the view, and
  // re-anchoring every render would fight somebody scrolling back.
  useEffect(() => {
    if (showHistory) return
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages.length, pending, showHistory])

  function submit(text: string) {
    setDraft("")
    setShowHistory(false)
    void send(text)
  }

  return (
    <div
      /**
       * **Sized by CSS, never by the animation library** — and it was the other
       * way round for exactly one revision, which produced two separate bugs.
       *
       * `animate={{ width, height }}` with no `initial` makes motion animate
       * *from what the element measures on its first paint*, so the panel
       * appeared at its content's full width and then shrank — which read as a
       * glitch rather than as an opening.
       *
       * Two classes and a CSS transition have no such failure mode: there is no
       * measured "from" and nothing is written inline, so the panel is whatever
       * size the mode says and nothing else.
       */
      className={cn(
        "flex max-h-[78vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-shop-hairline bg-card shadow-[0_24px_60px_-12px_rgb(0_0_0/0.28)]",
        "transition-[width,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        mode === "expanded" ? "h-[40rem] w-[30rem]" : "h-[34rem] w-[26rem]",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1">
          <HeaderButton
            label={t("history")}
            active={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="size-4" />
          </HeaderButton>
          <span className="ms-1 inline-flex items-center gap-1.5 font-heading text-sm font-medium tracking-tight">
            <Sparkles className="size-3.5 text-shop-accent" aria-hidden />
            {shop?.name ?? slug}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <HeaderButton
            label={mode === "expanded" ? t("shrink") : t("expand")}
            onClick={() =>
              setMode(mode === "expanded" ? "compact" : "expanded")
            }
          >
            {mode === "expanded" ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </HeaderButton>
          <HeaderButton label={t("close")} onClick={onClose}>
            <Minus className="size-4" />
          </HeaderButton>
        </div>
      </header>

      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4"
      >
        <AnimatePresence mode="wait" initial={false}>
          {showHistory ? (
            <m.div
              key="history"
              className="space-y-1 py-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <button
                type="button"
                onClick={() => {
                  startNew()
                  setShowHistory(false)
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors hover:bg-shop-accent-soft hover:text-shop-accent"
              >
                <Plus className="size-4 text-shop-accent" aria-hidden />
                {t("newChat")}
              </button>

              {history.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("historyEmpty")}
                </p>
              ) : (
                history.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      restore(conversation.id)
                      setShowHistory(false)
                    }}
                    className="block w-full truncate rounded-xl px-3 py-2.5 text-start text-sm text-muted-foreground transition-colors hover:bg-shop-accent-soft hover:text-shop-accent"
                  >
                    {conversation.title}
                  </button>
                ))
              )}
            </m.div>
          ) : (
            <m.div
              key="chat"
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {messages.length === 0 && (
                <div className="space-y-5 py-8">
                  <div>
                    <p className="font-heading text-shop-title leading-snug">
                      {t("emptyTitle")}
                    </p>
                    <p className="mt-1.5 text-shop-body leading-relaxed text-muted-foreground">
                      {t("emptyBody")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STARTER_KEYS.map((key, i) => (
                      <m.button
                        key={key}
                        type="button"
                        onClick={() => submit(t(key))}
                        className="rounded-full border border-shop-hairline bg-card px-3.5 py-2 text-xs transition-colors hover:border-shop-accent hover:text-shop-accent"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06, duration: 0.24 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        {t(key)}
                      </m.button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) =>
                message.role === "customer" ? (
                  <m.p
                    key={message.id}
                    className="ms-auto w-fit max-w-[85%] rounded-2xl bg-foreground px-3.5 py-2 text-sm leading-relaxed text-background"
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 460, damping: 34 }}
                  >
                    {message.text}
                  </m.p>
                ) : (
                  <m.div
                    key={message.id}
                    className="space-y-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {message.failed ? (
                      <p className="text-sm text-muted-foreground">
                        {failureLabel(message.refused, t)}
                      </p>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.text}
                      </p>
                    )}
                    {message.products && message.products.length > 0 && (
                      <AssistantProducts
                        products={message.products}
                        searchedFor={message.searchedFor}
                      />
                    )}
                    {message.additions && message.additions.length > 0 && (
                      <AssistantAdded additions={message.additions} />
                    )}
                    {message.negotiationOffers
                      ?.filter(
                        (offer, index, arr) =>
                          latestNegCtaMessageId.get(offer.session_id) ===
                            message.id &&
                          arr.findIndex(
                            (o) => o.session_id === offer.session_id,
                          ) === index,
                      )
                      .map((offer) => (
                        <AssistantNegotiationCta
                          key={offer.session_id}
                          offer={offer}
                        />
                      ))}
                    {message.escalated && (
                      <p className="text-xs text-muted-foreground">
                        {t("escalated")}
                      </p>
                    )}
                  </m.div>
                ),
              )}

              {/*
                The turn, while it is still running.

                The cards arrive several seconds before the sentence that goes
                above them — the server sends them the moment a search finds
                them — so they are drawn here, outside the transcript, and move
                into the finished message when it lands. Rendering them into a
                half-built message instead would put an empty bubble in the
                transcript, and the transcript is what gets replayed as history.
              */}
              {preview && preview.products.length > 0 && (
                <AssistantProducts
                  products={preview.products}
                  searchedFor={preview.searchedFor}
                />
              )}

              <AnimatePresence>
                {pending && (
                  <m.div
                    key="thinking"
                    className="flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    // The label is the caption when there is one, so a screen
                    // reader hears what the assistant is doing rather than the
                    // same word for every wait.
                    aria-label={phaseLabel(phase, t) ?? t("thinking")}
                    aria-live="polite"
                  >
                    <span className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <m.span
                          key={i}
                          className="size-1.5 rounded-full bg-muted-foreground/60"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{
                            duration: 1.1,
                            repeat: Infinity,
                            delay: i * 0.16,
                            ease: "easeInOut",
                          }}
                        />
                      ))}
                    </span>

                    {/*
                      What the turn is actually doing, when the stream said.
                      Dots alone are the same picture for two seconds and for
                      twenty; "Searching for jackets" is the difference between
                      waiting and watching. Absent when the transport could not
                      stream, which is why the dots stay rather than being
                      replaced by this.
                    */}
                    <AnimatePresence mode="wait">
                      {phaseLabel(phase, t) && (
                        <m.span
                          key={`${phase?.name}:${phase?.query ?? ""}`}
                          className="min-w-0 truncate text-xs text-muted-foreground"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.16 }}
                        >
                          {phaseLabel(phase, t)}
                        </m.span>
                      )}
                    </AnimatePresence>
                  </m.div>
                )}
              </AnimatePresence>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <form
        className="p-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-shop-hairline bg-card py-1.5 ps-4 pe-1.5 transition-colors focus-within:border-shop-accent">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <m.button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label={t("send")}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full bg-shop-accent text-shop-accent-foreground transition-opacity",
              (!draft.trim() || pending) && "opacity-30",
            )}
            whileTap={draft.trim() ? { scale: 0.9 } : undefined}
          >
            <ArrowUp className="size-4 rtl:-scale-x-100" />
          </m.button>
        </div>
      </form>
    </div>
  )
}

/**
 * One header control.
 *
 * Icon-only with an accessible label: the header has three of these in a strip
 * narrower than a phone, and tooltips there would cover the conversation they
 * sit above.
 */
function HeaderButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "grid size-8 place-items-center rounded-full transition-colors",
        active
          ? "bg-shop-accent text-shop-accent-foreground"
          : "text-muted-foreground hover:bg-shop-accent-soft hover:text-shop-accent",
      )}
    >
      {children}
    </button>
  )
}
