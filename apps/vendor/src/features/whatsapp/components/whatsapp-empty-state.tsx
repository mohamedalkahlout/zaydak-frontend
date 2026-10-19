"use client"

import { useTranslations } from "next-intl"
import {
  AlertTriangle,
  Loader2,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"

/** The four things a merchant does not know before they press the button. */
const FACTS = [
  { key: "oneNumber", icon: Smartphone },
  { key: "qr", icon: QrCode },
  { key: "existing", icon: MessageCircle },
  { key: "noTyping", icon: UserRound },
] as const

/**
 * Before anything exists: the screen that has to teach rather than report.
 *
 * Its own component rather than a fifth branch of the account card, because it
 * is doing a different job. The card answers "what is the state of my
 * connection"; this answers "what am I about to agree to, and what will it
 * cost me" — a question the card never has to ask again after the first scan,
 * and the only screen in the feature where a merchant has no prior idea what
 * the words mean.
 *
 * The four facts are the four wrong assumptions, in the order a merchant makes
 * them: that they will need a second SIM, that it involves an application
 * form, that the number they already use is disqualified, and that they will
 * have to type it in. Each one is a reason someone abandons this screen, and
 * all four are answerable in a line.
 *
 * The consent block sits between the explanation and the button, and nothing
 * is fetched before the press: no QR exists until the merchant has read what
 * scanning one grants.
 */
export function WhatsAppEmptyState({
  available,
  connecting,
  onConnect,
}: {
  /** False when the platform has no WhatsApp provider — not the vendor's to fix. */
  available: boolean
  connecting: boolean
  onConnect: () => void
}) {
  const t = useTranslations("settings.whatsapp")

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 ring-inset"
        >
          <MessageCircle className="size-6" />
        </span>
        <h3 className="font-heading text-lg leading-snug font-medium">
          {t("empty.title")}
        </h3>
        <p className="max-w-md text-sm leading-relaxed text-balance text-muted-foreground">
          {t("empty.body")}
        </p>
      </div>

      {/* Nothing the vendor can act on: no WhatsApp provider is enabled for
          the platform at all. Saying so beats a Connect button that fails,
          and the facts below would be teaching them about a thing they cannot
          have — so they are not shown. */}
      {!available ? (
        <div className="mx-4 mb-6 flex items-start gap-3 rounded-lg bg-muted/60 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("state.unavailable.body")}
          </p>
        </div>
      ) : (
        <div className="space-y-5 px-4 pb-6 sm:px-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {FACTS.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-lg bg-muted/50 p-3"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm leading-snug">
                  {t(`empty.facts.${key}`)}
                </span>
              </li>
            ))}
          </ul>

          {/* The consent text, above the button and not in a footnote. What the
              scan grants is bigger than this screen's subject: access to every
              conversation on the account, not only the ones about the shop. */}
          <div className="rounded-lg bg-amber-500/5 p-3 ring-1 ring-amber-500/20 ring-inset">
            <p className="flex items-start gap-2 text-sm font-medium">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {t("consent.title")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("consent.body")}
            </p>
          </div>

          <Button
            className="w-full sm:w-auto"
            onClick={onConnect}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageCircle className="size-4" />
            )}
            {t("action.connect")}
          </Button>
        </div>
      )}
    </section>
  )
}
