import {
  FolderIcon,
  InboxIcon,
  PackageIcon,
  TicketPercentIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"
import type { Translate } from "@/shared/i18n/translator"

/**
 * The entity kinds the @-mention picker can reference. Each maps to a
 * root-menu category and drives how a picked chip is serialized into the
 * message the agent receives (see `serializeMentions`).
 */
export type MentionType =
  | "product"
  | "collection"
  | "order"
  | "customer"
  | "coupon"

export interface MentionCandidate {
  type: MentionType
  id: string
  /** Primary label — the chip text and dropdown row title. */
  display: string
  /** Secondary line (slug, phone, status…) shown under the title. */
  secondary?: string
}

export interface MentionCategoryDef {
  /** Also names its label: `aiChat.mention.categories.<key>`. */
  key: MentionType
  Icon: LucideIcon
  /** Tailwind text-color class for the row/chip icon. */
  color: string
  /** Soft tinted background for the icon container in the picker. */
  tint: string
}

/**
 * Root-menu categories, in display order. Mirrors Shopify Sidekick's
 * hierarchical `@` picker: pick a category, then an entity inside it.
 * "Apps" from Shopify is intentionally omitted — this platform has no
 * installed-apps concept.
 */
export const MENTION_CATEGORIES: readonly MentionCategoryDef[] = [
  {
    key: "product",
    Icon: PackageIcon,
    color: "text-indigo-500",
    tint: "bg-indigo-500/10",
  },
  {
    key: "collection",
    Icon: FolderIcon,
    color: "text-emerald-500",
    tint: "bg-emerald-500/10",
  },
  {
    key: "order",
    Icon: InboxIcon,
    color: "text-sky-500",
    tint: "bg-sky-500/10",
  },
  {
    key: "customer",
    Icon: UserIcon,
    color: "text-amber-500",
    tint: "bg-amber-500/10",
  },
  {
    key: "coupon",
    Icon: TicketPercentIcon,
    color: "text-rose-500",
    tint: "bg-rose-500/10",
  },
]

const CATEGORY_BY_KEY = new Map(MENTION_CATEGORIES.map((c) => [c.key, c]))

export function mentionCategory(key: MentionType): MentionCategoryDef {
  // Every MentionType has a category, so this is always defined; the
  // fallback keeps TS happy without a non-null assertion.
  return CATEGORY_BY_KEY.get(key) ?? MENTION_CATEGORIES[0]
}

/** The category's name ("Products"), from a translator scoped to
 * `aiChat.mention`. */
export function categoryLabel(def: MentionCategoryDef, t: Translate): string {
  return t(`categories.${def.key}`)
}

/** Stable identity for a picked mention — used to dedupe chips. */
export function mentionKey(m: Pick<MentionCandidate, "type" | "id">): string {
  return `${m.type}:${m.id}`
}

/**
 * Returns the text of the "@" token the caret currently sits inside, or
 * `null` if the caret is not in a mention. We walk backwards from the caret:
 * an "@" that starts the string or follows whitespace opens a mention; any
 * intervening whitespace (or an "@" preceded by a non-space, i.e. an email)
 * means there is no active mention.
 */
export function detectMentionQuery(value: string, caret: number): string | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i]
    if (ch === "@") {
      if (i === 0 || /\s/.test(value[i - 1])) return value.slice(i + 1, caret)
      return null
    }
    if (/\s/.test(ch)) return null
  }
  return null
}

/**
 * Index of the "@" that opened the token the caret sits in, or -1. Used to
 * splice the token out (chip pick) or collapse it back to a bare "@"
 * (category drill-in / back).
 */
export function findMentionStart(value: string, caret: number): number {
  for (let i = caret - 1; i >= 0; i--) {
    if (value[i] === "@") return i
    if (/\s/.test(value[i])) break
  }
  return -1
}

/**
 * Machine-readable tail appended to the outgoing message so the agent can
 * resolve a mentioned entity by id without a redundant search call. Format:
 *
 *   [Referenced: product:abc "هودي صيفي"; order:xyz "#TR-1023"]
 *
 * The block is stripped from the bubble before display (see
 * `parseMentionTag`). The agent prompt doesn't require this shape — it's a
 * hint the model reads as plain context.
 */
export function serializeMentions(mentions: MentionCandidate[]): string {
  if (mentions.length === 0) return ""
  const parts = mentions.map(
    (m) => `${m.type}:${m.id} "${m.display.replace(/"/g, "'")}"`,
  )
  return `\n\n[Referenced: ${parts.join("; ")}]`
}

const MENTION_TAG_RE = /\n*\[Referenced:\s*([^\]]*)\]\s*$/
const MENTION_ITEM_RE = /(\w+):([^\s"]+)\s+"([^"]+)"/g

/**
 * Splits a stored user message into its visible text and the mentions that
 * were serialized onto its tail. Mirrors `parseMessageContent`'s handling
 * of the `[Attached images: …]` tag.
 */
export function parseMentionTag(raw: string): {
  text: string
  mentions: Array<{ type: MentionType; display: string }>
} {
  const match = raw.match(MENTION_TAG_RE)
  if (!match) return { text: raw, mentions: [] }
  const mentions: Array<{ type: MentionType; display: string }> = []
  for (const m of match[1].matchAll(MENTION_ITEM_RE)) {
    mentions.push({ type: m[1] as MentionType, display: m[3] })
  }
  return { text: raw.replace(MENTION_TAG_RE, "").trim(), mentions }
}

/** Matches the back-end's `CONVERSATION_TITLE_MAX_LENGTH`. */
export const CONVERSATION_TITLE_MAX_LENGTH = 60

/**
 * A thread's title from its first user message.
 *
 * Mirrors `conversationTitleFrom` in the back-end's
 * `vendor-agent/agent/conversation-title.ts`, which is the source of truth —
 * the sidebar shows what the server derived, and the exported Markdown has to
 * agree with it or the same thread carries two different names.
 *
 * Three things in order, and the order is the point. The `[Referenced: …]`
 * tail comes off first, then inline `@Display` tokens are flattened to the
 * plain words they read as, and only **then** is it truncated — so the 60
 * characters are 60 of the vendor's own words rather than of a tag that was
 * about to be removed.
 *
 * A message that is *only* a tail (the vendor picked a product and sent
 * without typing) has no visible text, so the things they picked are the
 * title rather than nothing.
 */
export function conversationTitleFrom(
  raw: string,
  maxLength: number = CONVERSATION_TITLE_MAX_LENGTH,
): string | null {
  if (!raw) return null

  const { text, mentions } = parseMentionTag(raw)
  const displays = mentions.map((m) => m.display.trim()).filter(Boolean)

  // Longest first, so "@Summer Hoodie" is not half-eaten by "@Summer".
  let visible = text
  for (const display of [...displays].sort((a, b) => b.length - a.length)) {
    visible = visible.split(`@${display}`).join(display)
  }
  visible = visible.replace(/\s+/gu, " ").trim()

  const source = visible || displays.join(", ")
  const title = source.slice(0, maxLength).trim()
  return title.length > 0 ? title : null
}
