"use client"

import { useCallback, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useMutation } from "@apollo/client/react"

import { useShop } from "@/features/shop/shop-context"
import { useShopTenant } from "@/shared/lib/use-shop-slug"
import { productSlugFromPath, shopRelativePath } from "@/shared/lib/tenant"
import { useCartSessionStore } from "@/shared/stores/cart-session"
import { AssistantTurnError, streamAssistantTurn } from "./lib/stream"
import { refusalOf } from "./lib/refusal"
import { useAssistantStore } from "./store"
// The product and addition types are no longer named here: the mutation's own
// generated types now flow straight into the transcript, so a cast that used to
// paper over a hand-written shape is gone with the shape.
import type { AssistantMessage, AssistantProduct } from "./types"
import { ASK_SHOP_ASSISTANT } from "./api"

/**
 * The panel's transcript, and the one call that advances it.
 *
 * **Nothing is stored server-side.** The WhatsApp thread is a merchant's record
 * and belongs in their inbox, but a shopper asking about a tote is not
 * correspondence, and filing every idle question would build a support archive
 * nobody asked for. The transcript lives in `useAssistantStore` — a module
 * store, so it survives the panel closing and every navigation, and ends with
 * the tab.
 *
 * The optimistic customer bubble is added **before** the request, because the
 * turn takes seconds — a model call with tool rounds inside it — and a panel
 * that swallows your message until the answer arrives reads as broken.
 */
export function useAssistant() {
  // The transcript lives in the store, not here: `AssistantPanel` unmounts
  // every time the pill closes, and state inside it would take the
  // conversation with it — which is exactly what a shopper minimising
  // mid-question does not expect.
  const messages = useAssistantStore((s) => s.messages)
  const setMessages = useAssistantStore((s) => s.setMessages)
  const [pending, setPending] = useState(false)
  /**
   * What the turn is doing right now, from the stream.
   *
   * Null when nothing is in flight or when the transport could not stream —
   * the panel falls back to its thinking dots, which is what it always showed.
   */
  const [phase, setPhase] = useState<{ name: string; query?: string } | null>(
    null,
  )
  /**
   * Cards the turn has already found, before the sentence above them exists.
   *
   * Held apart from `messages` because they belong to a turn that has not
   * finished: folding them into a half-built assistant message would put an
   * empty bubble in the transcript, and the transcript is what gets replayed as
   * history on the next turn.
   */
  const [preview, setPreview] = useState<{
    products: AssistantProduct[]
    searchedFor: string[]
  } | null>(null)
  const { slug: shopSlug } = useShop()
  const adopt = useCartSessionStore((s) => s.adopt)
  /**
   * The product the shopper is standing behind the panel, if any.
   *
   * Sent with every turn rather than only a negotiating one: "is this in blue?"
   * on a product page is the same kind of sentence, and the back-end decides
   * what to do with it. Derived from the path because the panel is mounted in
   * the shop layout and does not re-render per route — `usePathname` is what
   * tells it where the shopper actually is.
   */
  const pathname = usePathname()
  const tenant = useShopTenant()
  const subjectProductSlug = useAssistantStore((s) => s.subjectProductSlug)
  const subjectVariationId = useAssistantStore((s) => s.subjectVariationId)
  const pageProductSlug =
    subjectProductSlug ??
    productSlugFromPath(shopRelativePath(pathname ?? "/", tenant)) ??
    undefined
  // The option selected when "negotiate" was pressed — only beside the
  // product it was selected on, never with a product read off the path.
  const pageVariationOptionId =
    subjectProductSlug && subjectVariationId ? subjectVariationId : undefined

  const [ask] = useMutation(ASK_SHOP_ASSISTANT)

  /**
   * A counter rather than `crypto.randomUUID()`.
   *
   * Keys only have to be unique within this list, and a UUID minted during
   * render is exactly the impurity the React Compiler rules reject.
   */
  const seq = useRef(0)
  const nextId = () => `m${++seq.current}`

  /**
   * File the finished turn and clear everything the stream was showing.
   *
   * One place, because both transports end here and the two used to append the
   * message in slightly different shapes. Clearing the preview in the same
   * update is what stops the cards being on screen twice for a frame — once as
   * the live preview and once inside the message that has just landed.
   */
  const appendAnswer = useCallback(
    (answer: Omit<AssistantMessage, "id" | "role">) => {
      setMessages((prev: AssistantMessage[]) => [
        ...prev,
        { id: nextId(), role: "assistant", ...answer },
      ])
      setPreview(null)
      setPhase(null)
    },
    [setMessages],
  )

  /**
   * File a turn that did not come back, saying when to retry if the shop
   * refused it for now rather than failing it.
   */
  const appendFailure = useCallback(
    (err?: unknown) => {
      const refused = err === undefined ? null : refusalOf(err)
      setMessages((prev: AssistantMessage[]) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text: "",
          failed: true,
          ...(refused ? { refused } : {}),
        },
      ])
    },
    [setMessages],
  )

  const send = useCallback(
    async (text: string) => {
      const message = text.trim()
      if (!message || pending) return

      setMessages((prev: AssistantMessage[]) => [
        ...prev,
        { id: nextId(), role: "customer", text: message },
      ])
      setPending(true)
      setPhase(null)

      // The same guest cart the header badge counts. `adopt` is idempotent, so
      // calling it per turn costs nothing.
      const sessionId = adopt()
      // Only what the assistant needs to follow a "and in blue?" — the back-end
      // caps this again on its own side.
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.text,
      }))

      /**
       * The streamed turn, and the mutation behind it.
       *
       * **The stream is an enhancement over a path that still works.** SSE is
       * the first thing an over-eager proxy breaks — buffering the whole
       * response, stripping the content type, or refusing a long-lived
       * connection — and none of that is visible from here beyond "the request
       * did not open". So a failure to *start* falls back to the mutation and
       * the shopper gets the same answer a beat later, rather than a panel that
       * works in development and not behind a CDN.
       *
       * A failure *mid-stream* is different and deliberately not retried: the
       * turn has already run and already been billed against the shop's plan,
       * and asking again would spend a second answer to recover a first one
       * that may well have been delivered.
       */
      try {
        let streamed = false
        try {
          for await (const event of streamAssistantTurn({
            shopSlug,
            message,
            sessionId,
            history,
            pageProductSlug,
            pageVariationOptionId,
          })) {
            streamed = true
            if (event.type === "tool_start") {
              setPhase({ name: event.name, query: event.query })
              continue
            }
            if (event.type === "products") {
              // Drawn while the model is still composing the sentence above
              // them, which is most of what makes the turn feel alive.
              setPreview({
                products: event.products,
                searchedFor: event.searched_for,
              })
              continue
            }
            appendAnswer({
              text: event.text,
              products: event.products,
              searchedFor: event.searched_for,
              additions: event.additions,
              negotiationOffers: event.negotiation_offers,
              escalated: event.escalated,
            })
            return
          }
          // The stream opened and ended with no answer — the connection died
          // mid-turn. Falling through to the mutation here would re-run and
          // re-bill a turn that already ran.
          if (streamed) {
            appendFailure()
            return
          }
        } catch (err) {
          // The server's own `error` frame is a verdict, not a transport that
          // failed to open: re-running the turn through the mutation would be
          // refused again (and anything else has already been tried). Handed
          // to the outer catch, which says how long to wait when it can.
          if (err instanceof AssistantTurnError) throw err
          // Never opened, or died before the first frame. The mutation is the
          // same turn over a transport nothing in the middle objects to.
          if (streamed) throw new Error("stream ended after it had begun")
        }

        const result = await ask({
          variables: {
            input: {
              message,
              session_id: sessionId,
              history,
              page_product_slug: pageProductSlug,
              page_variation_option_id: pageVariationOptionId,
            },
          },
        })

        const data = result.data?.askShopAssistant.data
        if (data) {
          appendAnswer({
            text: data.text,
            products: data.products,
            // The heading over the cards — the terms the turn actually
            // searched for, not anything read out of the reply.
            searchedFor: data.searched_for,
            additions: data.additions,
            negotiationOffers: data.negotiation_offers ?? [],
            escalated: data.escalated,
          })
        } else {
          appendFailure()
        }
      } catch (err) {
        // Shown, not swallowed. Somebody is watching a spinner in a panel they
        // opened, and silence is the panel appearing broken. A refusal — from
        // the stream's `error` frame or the mutation's `TOO_MANY_REQUESTS` —
        // says when to come back instead.
        appendFailure(err)
      } finally {
        setPending(false)
        // Both cleared here as well as in `appendAnswer`, because every failure
        // path reaches this and none of them reach that one. A turn that ended
        // in an error must not leave "Searching for jackets…" on screen, or a
        // row of cards floating under a message saying it did not go through.
        setPhase(null)
        setPreview(null)
      }
    },
    [
      adopt,
      appendAnswer,
      appendFailure,
      ask,
      messages,
      pageProductSlug,
      pageVariationOptionId,
      pending,
      setMessages,
      shopSlug,
    ],
  )

  return { messages, pending, phase, preview, send }
}
