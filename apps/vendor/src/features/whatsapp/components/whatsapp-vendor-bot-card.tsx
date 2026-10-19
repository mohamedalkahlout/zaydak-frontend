"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Bot, CheckCircle2, ExternalLink, Loader2, Unplug } from "lucide-react";
import { sileo } from "sileo";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { GET_MY_VENDOR_BOT, UNLINK_VENDOR_BOT } from "@/features/vendor-bot";
import type {
  UnlinkVendorBotResult,
  VendorBotStatusResult,
} from "@/features/vendor-bot";
import { assistantState, type AssistantState } from "../lib/assistant";
import { WhatsAppStatusPill, type PillTone } from "./whatsapp-status-pill";

/**
 * Which of the four looks each state wears.
 *
 * `unlinked` is `off`, not `fault`: a store nobody has connected the assistant
 * to yet is an invitation, not a failure. `unavailable` is `off` too — the
 * vendor cannot fix a platform number being down, so colouring it red would
 * alarm them about something they cannot act on.
 */
const TONE: Record<AssistantState, PillTone> = {
  unavailable: "off",
  unlinked: "off",
  linked: "live",
};

/**
 * The Zaydak assistant, on the WhatsApp screen but never mixed into it.
 *
 * **This is a different number from the card above it, and the entire design
 * of this card is about making that impossible to miss.** The one above is the
 * merchant's own number, which they paired, and which their customers write
 * to. This one is the platform's, which the merchant never pairs, and which
 * *they* write to. Two numbers, two directions, two audiences — a vendor who
 * conflates them will hand a customer the wrong number to contact.
 *
 * So it is visually the quieter of the two: a muted plate rather than the
 * shop's live green, a "Zaydak" label on the number, and no connection
 * controls at all. There is no QR here and there must never be one — nothing
 * on this card pairs anything, because the session behind it belongs to the
 * platform and is managed in the admin console.
 *
 * **The pill reports this store's enrolment, not the platform's uptime**, and
 * that distinction is the whole bug this card once had. `available` is true for
 * every vendor the moment an admin pairs the assistant number, so rendering it
 * as the status showed a green "Online" on a store created a minute ago where
 * nothing had been connected — sitting directly under a card where the same
 * word means "your customers can reach you". A vendor reads the two as one
 * claim. `assistantState` keeps them apart.
 *
 * **This card is the whole feature now.** It used to be a summary linking to a
 * settings screen of its own, and that screen existed to hold a pairing flow —
 * a six-digit code the vendor sent from their handset. Enrolment moved into the
 * shop's own QR scan (which already proves the account and the phone), so the
 * screen had nothing left to *do*: what remained was which phone is enrolled,
 * which store it answers about, and a way to revoke it. Three facts belong
 * beside the number they are about, not behind a click.
 */
export function WhatsAppVendorBotCard() {
  const t = useTranslations("settings.whatsapp.vendorBot");
  const format = useFormatter();
  // `relativeTime` needs an anchor. Without one it reads the wall clock on
  // every render — which next-intl warns about, because a value that changes
  // mid-render is exactly the thing React is allowed to render twice. `useNow`
  // holds the anchor in state and, with an interval, advances it on a tick the
  // component actually re-renders for, so "2 minutes ago" ages by itself.
  const now = useNow({ updateInterval: 60_000 });

  // The assistant's own session is reconciled against the provider on read, so
  // a number that went down while this tab sat open is corrected by asking
  // again rather than served from a cache that cannot know.
  const { data, loading, refetch } = useQuery<VendorBotStatusResult>(
    GET_MY_VENDOR_BOT,
    { fetchPolicy: "cache-and-network" },
  );

  const [unlink, { loading: unlinking }] = useMutation<UnlinkVendorBotResult>(
    UNLINK_VENDOR_BOT,
    {
      onCompleted: () => {
        sileo.success({ title: t("toast.unlinked") });
        void refetch();
      },
      onError: (err) =>
        sileo.error({
          title: t("toast.unlinkFailed"),
          description: err.message,
        }),
    },
  );

  const status = data?.myVendorBot?.data;
  const available = status?.available ?? false;
  const number = status?.bot_number ?? null;
  // Already scoped to this store by `X-SHOP` — a sibling store's handset never
  // arrives here, so there is nothing for the card to filter or compare.
  const linked = status?.link ?? null;
  const state = assistantState(available, linked);

  if (loading && !data) {
    return (
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-3 h-16 w-full" />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-foreground/70 ring-1 ring-foreground/10 ring-inset"
          >
            <Bot className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-heading text-base leading-snug font-medium">
              {t("title")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <WhatsAppStatusPill tone={TONE[state]} label={t(`pill.${state}`)} />
      </div>

      <div className="space-y-4 px-4 pb-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("body")}
        </p>

        {/* The number, labelled as the platform's. The label is doing real
            work: an unlabelled second number on a WhatsApp settings screen
            reads as the shop's own, which is the one misreading this card
            exists to prevent. */}
        {available && number && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("numberLabel")}
            </span>
            <span dir="ltr" className="font-mono text-sm tabular-nums">
              {number}
            </span>
          </div>
        )}

        {/* Which of the vendor's phones can write, and what it answers about.
            The pinned store is stated on the settled card rather than only
            while choosing: an answer about the wrong shop is the one mistake a
            vendor would never think to check for. */}
        {state === "linked" && linked && (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-500/5 p-3 ring-1 ring-emerald-500/20 ring-inset">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {t("linked", { phone: linked.phone_masked ?? "" })}
              </p>
              <p className="text-xs text-muted-foreground">{t("answersHere")}</p>
              {linked.last_message_at && (
                <p className="text-xs text-muted-foreground">
                  {t("lastMessage", {
                    when: format.relativeTime(
                      new Date(linked.last_message_at),
                      now,
                    ),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {available && number && (
            /* `wa.me` opens the merchant's own WhatsApp on whichever device
               they are reading this on, already addressed to the assistant.
               Digits only — wa.me rejects the punctuation E.164 carries. */
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={`https://wa.me/${number.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink className="size-4" />
              {t("open")}
            </Button>
          )}
          {/* Revoking is the only write on this card, and it is a ghost button
              rather than a destructive one: scanning this store's WhatsApp
              above enrols the handset again, so nothing here is permanent and
              red would misrepresent what it costs. */}
          {state === "linked" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={unlinking}
              onClick={() => void unlink()}
            >
              {unlinking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unplug className="size-4" />
              )}
              {t("unlink")}
            </Button>
          )}
        </div>

        {/* Two different facts, and which one a merchant needs depends on where
            they are. Before enrolment the question in their head is "do I have
            to scan something for this too?"; after it, that question is gone
            and the useful thing is which phone may write. Read-only is said in
            both, because a vendor who learns it only when a request is refused
            has already formed the wrong expectation. */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(state === "linked" ? "enrolled" : "noPairing")} {t("readOnly")}
        </p>
      </div>
    </section>
  );
}
