"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ArrowLeft, MessageCircle } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"
import { GET_WHATSAPP_THREADS } from "../api"
import type { WhatsAppThreadsResult } from "../types"
import { useWhatsAppInboxStream } from "../use-whatsapp-inbox-stream"
import { ThreadList } from "./thread-list"
import { ThreadView } from "./thread-view"

/**
 * The shop's WhatsApp conversations.
 *
 * **This is the screen the customer assistant was always missing.** The bot
 * answers in the merchant's name on the merchant's own number, and until this
 * existed there was nowhere to see what it had said — the data carried three
 * distinguishable voices and nothing rendered them. A merchant who cannot read
 * their own thread cannot judge whether to leave the assistant on.
 *
 * Two panes on a desktop, one at a time on a phone. The phone case is not a
 * degraded desktop: a merchant checking a customer on their way somewhere wants
 * the conversation full-width, and a 30%-wide thread beside a list nobody is
 * reading serves neither.
 */
export function WhatsAppInboxPage() {
  const t = useTranslations("whatsappInbox")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const { data, loading, refetch } = useQuery<WhatsAppThreadsResult>(
    GET_WHATSAPP_THREADS,
    {
      variables: {
        page: 1,
        limit: 30,
        search: search.trim() ? search.trim() : undefined,
      },
      // Customers write while this sits open; a cache read alone would show the
      // inbox as of whenever it was last visited.
      fetchPolicy: "cache-and-network",
    },
  )

  // Real-time instant notifications via SSE instead of 30s polling
  useWhatsAppInboxStream(() => {
    void refetch()
  })

  const threads = data?.shopWhatsAppThreads?.data?.threads ?? []

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 ring-inset"
        >
          <MessageCircle className="size-5" />
        </span>
        <div>
          <h1 className="font-heading text-lg leading-snug font-medium">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="grid min-h-[32rem] md:grid-cols-[20rem_1fr]">
          {/* The list. Hidden on a phone once a thread is open — see above. */}
          <div
            className={cn(
              "min-h-0 overflow-y-auto md:border-e md:border-border",
              activeId ? "hidden md:block" : "block",
            )}
          >
            <ThreadList
              threads={threads}
              loading={loading}
              activeId={activeId}
              onSelect={setActiveId}
              search={search}
              onSearchChange={setSearch}
            />
          </div>

          <div className={cn("min-h-0", activeId ? "block" : "hidden md:block")}>
            {activeId ? (
              <div className="flex h-full min-h-0 flex-col">
                {/* The way back, on phones only: on a desktop the list never
                    left, so a back button would undo nothing. */}
                <div className="border-b border-border p-2 md:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveId(null)}
                  >
                    <ArrowLeft className="size-4 rtl:rotate-180" />
                    {t("backToList")}
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <ThreadView threadId={activeId} />
                </div>
              </div>
            ) : (
              <div className="hidden h-full flex-col items-center justify-center gap-2 p-8 text-center md:flex">
                <MessageCircle
                  className="size-8 text-muted-foreground/50"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  {t("pickAThread")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
