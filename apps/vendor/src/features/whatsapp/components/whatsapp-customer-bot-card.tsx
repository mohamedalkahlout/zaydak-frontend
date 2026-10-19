"use client"

import { useTranslations } from "next-intl"
import { Bot, Check, Loader2, ShoppingBag, Sparkles } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { Switch } from "@repo/ui/components/switch"
import { cn } from "@/shared/lib/utils"

/** What a customer can ask, as the vendor's own list rather than a promise. */
const TOPICS = [
  "products",
  "prices",
  "availability",
  "orders",
  "shipping",
  "store",
] as const

/**
 * The Customer AI Bot: one switch, and the whole card exists to say what it
 * costs.
 *
 * The switch controls whether something other than the merchant replies to
 * their customers, in the merchant's name, on the merchant's number. That is
 * the largest consequence anywhere in Settings, and it is why this is a card
 * of its own rather than a row inside the connection card: pairing a number
 * and delegating the answers are two decisions, and a merchant must be able to
 * make the first without having made the second.
 *
 * Which is also why **the default is off and there is a deliberate ask.**
 * Straight after a successful scan the card leads with the question rather
 * than a settled switch, because the alternative — a bot quietly enabled by
 * the act of connecting — means the first a vendor learns of it is a customer
 * receiving an answer they never wrote. That is not a preference we get to set
 * for them.
 *
 * Both states carry their consequence in full. Off is not "nothing happens":
 * messages are still received and still stored, and the vendor answers them
 * themselves — a merchant who reads "off" as "WhatsApp stops working" turns it
 * back on for the wrong reason.
 *
 * The card is the same decision on every customer channel, so the only thing
 * a channel supplies is its copy: `namespace` points at a message tree of this
 * shape (`settings.telegram.shopBot.bot` for the shop's Telegram bot) and
 * defaults to WhatsApp's. The switch, the ask and the topics are deliberately
 * not channel-aware — the assistant that answers is one assistant, and a card
 * per channel would drift into promising different things on each.
 *
 * `orders` is the one exception, and it is optional for that reason: it is
 * a switch on the channel's own row (the WhatsApp instance, the Telegram bot),
 * so each caller passes its own mutation and a card without one shows none.
 */
export function WhatsAppCustomerBotCard({
  enabled,
  /** True until the vendor has answered the question either way. */
  undecided,
  saving,
  onEnable,
  onDisable,
  namespace = "settings.whatsapp.bot",
  orders,
}: {
  enabled: boolean
  undecided: boolean
  saving: boolean
  onEnable: () => void
  onDisable: () => void
  /** The message tree this card reads its copy from. */
  namespace?: string
  /** The "take orders in the chat" switch. Omitted, it is not shown. */
  orders?: OrdersSwitch
}) {
  const t = useTranslations(namespace)

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 transition-colors",
        enabled ? "ring-primary/20" : "ring-foreground/10",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors",
              enabled
                ? "bg-primary/10 text-primary ring-primary/20"
                : "bg-muted text-muted-foreground ring-foreground/10",
            )}
          >
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-heading text-base leading-snug font-medium">
              {t("title")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>

        {/* The switch is absent while undecided. A control already sitting in
            a position is an answer, and the point of the ask below is that
            nobody has given one yet. */}
        {!undecided && (
          <label className="flex shrink-0 items-center gap-2.5">
            <span
              className={cn(
                "text-xs font-semibold tracking-wide uppercase",
                enabled ? "text-primary" : "text-muted-foreground",
              )}
            >
              {t(enabled ? "on" : "off")}
            </span>
            <Switch
              checked={enabled}
              disabled={saving}
              onCheckedChange={(next) => (next ? onEnable() : onDisable())}
              aria-label={t("title")}
            />
          </label>
        )}
      </div>

      <div className="space-y-4 px-4 pb-4">
        {undecided ? (
          <Ask
            namespace={namespace}
            saving={saving}
            onEnable={onEnable}
            onDisable={onDisable}
          />
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(enabled ? "onBody" : "offBody")}
            </p>
            {enabled && <Topics namespace={namespace} />}
            {/* Only under a live assistant: ordering is something the
                assistant does, and a switch for it beside an assistant that
                is off would configure nothing. */}
            {enabled && orders && (
              <OrdersRow namespace={namespace} {...orders} />
            )}
          </>
        )}
      </div>
    </section>
  )
}

export interface OrdersSwitch {
  enabled: boolean
  /** Whether the shop's plan includes `ai.agent.checkout`. */
  allowed: boolean
  /** The plan is still being read. */
  loading: boolean
  saving: boolean
  onEnable: () => void
  onDisable: () => void
}

/**
 * Taking orders in the chat, as a second switch under the assistant's.
 *
 * **Off is always reachable.** A shop whose plan lost the capability keeps
 * the switch live while it is on, so it can be turned off; only turning it on
 * waits for the plan. The server holds the same line.
 */
function OrdersRow({
  namespace,
  enabled,
  allowed,
  loading,
  saving,
  onEnable,
  onDisable,
}: OrdersSwitch & { namespace: string }) {
  const t = useTranslations(`${namespace}.orders`)
  const locked = !enabled && (loading || !allowed)

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/60 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <ShoppingBag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("title")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("body")}
          </p>
          {!loading && !allowed && (
            <p className="text-xs text-muted-foreground">{t("notOnPlan")}</p>
          )}
        </div>
      </div>
      <label className="flex shrink-0 items-center gap-2.5">
        <span
          className={cn(
            "text-xs font-semibold tracking-wide uppercase",
            enabled ? "text-primary" : "text-muted-foreground",
          )}
        >
          {t(enabled ? "on" : "off")}
        </span>
        <Switch
          checked={enabled}
          disabled={saving || locked}
          onCheckedChange={(next) => (next ? onEnable() : onDisable())}
          aria-label={t("title")}
        />
      </label>
    </div>
  )
}

/**
 * The question, asked once.
 *
 * Two buttons rather than a pre-set switch, because a switch has no "not
 * answered" position and this state exists precisely to represent one. Turning
 * it on is the primary — it is what the feature is for — but "not now" is a
 * full-sized button beside it rather than a link, so declining costs the same
 * effort as accepting.
 */
function Ask({
  namespace,
  saving,
  onEnable,
  onDisable,
}: {
  namespace: string
  saving: boolean
  onEnable: () => void
  onDisable: () => void
}) {
  const t = useTranslations(namespace)
  return (
    <div className="space-y-4 rounded-lg bg-muted/60 p-4">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("ask.title")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("ask.body")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onEnable} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("ask.enable")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDisable}
          disabled={saving}
        >
          {t("ask.decline")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("ask.reversible")}</p>
    </div>
  )
}

/**
 * What the assistant will field, listed.
 *
 * Concrete nouns rather than "answers customer questions": the merchant is
 * deciding whether to hand over their inbox, and the only way to judge that is
 * to see the range. Shown under "on" only — under "off" it would read as an
 * advert for a thing they just declined.
 */
function Topics({ namespace }: { namespace: string }) {
  const t = useTranslations(`${namespace}.topics`)
  return (
    <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {TOPICS.map((topic) => (
        <li
          key={topic}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Check className="size-3.5 shrink-0 text-primary/70" />
          {t(topic)}
        </li>
      ))}
    </ul>
  )
}
