import {
  ClipboardPenIcon,
  MessageCircleIcon,
  SendIcon,
  StoreIcon,
  type LucideIcon,
} from "lucide-react"

/**
 * Where an order was placed, as the back-end's `SalesChannel` enum names it.
 * Derived from the order at read time: `placed_via` for the two chat
 * assistants, a converted draft for an order the merchant built, and the
 * storefront for everything else.
 *
 * The order here is the display order wherever a channel list is not sorted
 * by value, so a channel keeps its place (and its colour) between periods.
 */
export const SALES_CHANNELS = [
  "ONLINE_STORE",
  "TELEGRAM",
  "WHATSAPP",
  "DRAFT_ORDER",
] as const

export type SalesChannel = (typeof SALES_CHANNELS)[number]

export function isSalesChannel(value: unknown): value is SalesChannel {
  return (
    typeof value === "string" &&
    (SALES_CHANNELS as readonly string[]).includes(value)
  )
}

/**
 * One identity per channel, shared by the analytics page and Sidekick's tool
 * cards. `color` is a concrete hex because recharts cannot read Tailwind
 * classes for SVG fills; `tone` is the icon-badge classes for HTML. Telegram
 * and WhatsApp keep the sky and emerald the orders list already marks them
 * with (`PlacedViaMark`), so a merchant sees the same colour for the same
 * channel on every screen.
 *
 * The four hexes are the Tailwind -600 steps of violet, sky, emerald and
 * orange, and were run through the dataviz palette validator as a
 * categorical set with every pair checked (the analytics ribbon sorts by
 * value, so any two channels can sit side by side): inside the lightness
 * band and at least 3:1 against both the light card (#ffffff) and the dark
 * one (#171717), worst colour-blind pair ΔE 9.2, worst normal-vision pair
 * 16.9. One value therefore serves both themes. The -500 steps this started
 * with failed on the dark card (too light) and on contrast against white,
 * and amber failed the colour-blind check against emerald, hence orange.
 * Re-run the validator before changing any of them.
 */
export const SALES_CHANNEL_META: Record<
  SalesChannel,
  { icon: LucideIcon; color: string; tone: string }
> = {
  ONLINE_STORE: {
    icon: StoreIcon,
    color: "#7c3aed",
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  TELEGRAM: {
    icon: SendIcon,
    color: "#0284c7",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  WHATSAPP: {
    icon: MessageCircleIcon,
    color: "#059669",
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  DRAFT_ORDER: {
    icon: ClipboardPenIcon,
    color: "#ea580c",
    tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
}
