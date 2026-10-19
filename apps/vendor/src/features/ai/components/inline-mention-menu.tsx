"use client"

import { useEffect, useId, useRef } from "react"
import { useTranslations } from "next-intl"
import { ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/shared/lib/utils"
import { useSafeReducedMotion } from "@repo/ui/hooks/use-hydrated"
import type { CaretAnchor } from "@/features/ai/lib/caret-anchor"
import {
  MENTION_CATEGORIES,
  categoryLabel,
  mentionCategory,
  type MentionCandidate,
  type MentionCategoryDef,
  type MentionType,
} from "@/features/ai/lib/mention-config"
import {
  INLINE_MENTION_LISTBOX_ID,
  inlineMentionOptionId,
} from "@/features/ai/hooks/inline-mention-aria"

/**
 * The slide-in panel's @-mention picker: the same two levels as the full-page
 * chat's `MentionDropdown` — root categories, then that category's entity
 * search — anchored at the caret rather than stretched across the composer.
 *
 * A separate component rather than new props on the shared one. Both composers
 * render `MentionDropdown` with an identical nine props today, so an optional
 * prop with a default is a change to the full-page chat's picker whether or
 * not it is passed; and the two differ in more than position anyway (this one
 * has no chips to fall back to, so the row a pick lands on is the whole
 * feedback, which is what the sliding highlight is for).
 *
 * It is the listbox half of a combobox whose input is `MentionTextarea`, so
 * the ids here are not decoration: the textarea's `aria-controls` names this
 * `<ul>` and its `aria-activedescendant` names one of these rows. They come
 * from `hooks/inline-mention-aria.ts` so that both sides derive them rather
 * than agreeing by convention. Two consequences are easy to undo by accident —
 * the listbox is rendered even when a category matched nothing (an open picker
 * whose `aria-controls` points at a missing element is worse than none), and
 * every row carries an id keyed by its index, because the index is what the
 * state machine highlights.
 */

/** Matches `w-62` below. The popup is clamped inside the composer by hand,
 *  because it is positioned from a measured pixel offset rather than by a
 *  layout its own container could constrain. */
const MENU_WIDTH = 248

function clampLeft(desired: number, hostWidth: number): number {
  return Math.min(Math.max(8, desired), Math.max(8, hostWidth - MENU_WIDTH - 8))
}

interface Props {
  /** `null` = root category menu; otherwise the drilled-in category. */
  category: MentionType | null
  candidates: MentionCandidate[]
  activeIndex: number
  loading: boolean
  /** The search errored. Apollo blanks `data` on error, so without this an
   *  unreachable API is indistinguishable from a shop with nothing in it. */
  failed?: boolean
  locale: "ar" | "en"
  /** `null` when the caret could not be measured — the popup then falls back
   *  to sitting above the whole composer, which is where it used to live. */
  anchor: CaretAnchor | null
  /** The `<ul role="listbox">` id the composer's `aria-controls` points at.
   *  Defaults to the shared constant, which is what lets the relationship hold
   *  without the two components being handed a matching id by their parent. */
  listboxId?: string
  onPickCategory: (key: MentionType) => void
  onPickCandidate: (candidate: MentionCandidate) => void
  onBack: () => void
  onHover: (index: number) => void
}

export function InlineMentionMenu({
  category,
  candidates,
  activeIndex,
  loading,
  failed,
  locale,
  anchor,
  listboxId = INLINE_MENTION_LISTBOX_ID,
  onPickCategory,
  onPickCandidate,
  onBack,
  onHover,
}: Props) {
  const t = useTranslations("aiChat")
  const tMention = useTranslations("aiChat.mention")
  const listRef = useRef<HTMLUListElement>(null)
  const reduceMotion = useSafeReducedMotion()
  const highlightId = useId()
  const isAr = locale === "ar"

  // Keep the highlighted row in view as the vendor arrows a long list.
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView?.({ block: "nearest" })
  }, [activeIndex])

  // Grow from the caret towards the inline start — leftwards in English, and
  // rightwards in Arabic, where the "@" is the popup's right edge — then keep
  // the whole thing inside the composer. With no measurement, park it above
  // the composer: the picker still works, it just is not following the caret.
  const placement: React.CSSProperties = anchor
    ? {
        left: clampLeft(
          anchor.rtl ? anchor.left + 14 - MENU_WIDTH : anchor.left - 14,
          anchor.hostWidth,
        ),
        // Measured from the top and lifted by its own height, so the popup
        // stays put on the keystroke that both wraps a line and opens it.
        top: anchor.top,
        transform: "translateY(calc(-100% - 6px))",
      }
    : { left: 8, bottom: "calc(100% + 8px)" }

  return (
    // The placement sits on a plain wrapper rather than on the animated box:
    // `motion` writes `transform` to animate, so the lift-by-own-height and
    // the entrance would overwrite each other on one element.
    <div className="absolute z-50" style={{ ...placement, width: MENU_WIDTH }}>
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0.12 }
          : { type: "spring", stiffness: 560, damping: 34, mass: 0.6 }
      }
      style={{ transformOrigin: isAr ? "bottom right" : "bottom left" }}
      className="w-full overflow-hidden rounded-2xl border border-border/70 bg-popover/95 shadow-lg shadow-black/8 ring-1 ring-black/5 backdrop-blur-sm"
    >
      {category === null ? (
        <>
          <SectionLabel>{t("mention.addReference")}</SectionLabel>
          <ul
            ref={listRef}
            role="listbox"
            id={listboxId}
            aria-label={t("mention.addReference")}
            className="p-1.5 pt-1"
          >
            {MENTION_CATEGORIES.map((def, i) => (
              <Row
                key={def.key}
                id={inlineMentionOptionId(i, listboxId)}
                def={def}
                highlightId={highlightId}
                reduceMotion={reduceMotion}
                title={categoryLabel(def, tMention)}
                active={i === activeIndex}
                onHover={() => onHover(i)}
                onPick={() => onPickCategory(def.key)}
                trailing={
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/40 rtl:rotate-180" />
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <CategoryLevel
          def={mentionCategory(category)}
          candidates={candidates}
          activeIndex={activeIndex}
          loading={loading}
          failed={failed}
          listRef={listRef}
          listboxId={listboxId}
          highlightId={highlightId}
          reduceMotion={reduceMotion}
          onPick={onPickCandidate}
          onBack={onBack}
          onHover={onHover}
        />
      )}
      <div className="hidden items-center gap-3 border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground sm:flex">
        <Hint keys="↑↓" label={t("mention.navigate")} />
        <Hint
          keys="↵"
          label={category === null ? t("mention.open") : t("mention.select")}
        />
        <Hint keys="esc" label={t("mention.close")} />
      </div>
    </motion.div>
    </div>
  )
}

/* ----------------------------- category level ----------------------------- */

function CategoryLevel({
  def,
  candidates,
  activeIndex,
  loading,
  failed,
  listRef,
  listboxId,
  highlightId,
  reduceMotion,
  onPick,
  onBack,
  onHover,
}: {
  def: MentionCategoryDef
  candidates: MentionCandidate[]
  activeIndex: number
  loading: boolean
  /** The search errored. Apollo blanks `data` on error, so without this an
   *  unreachable API is indistinguishable from a shop with nothing in it. */
  failed?: boolean
  listRef: React.RefObject<HTMLUListElement | null>
  listboxId: string
  highlightId: string
  reduceMotion: boolean
  onPick: (c: MentionCandidate) => void
  onBack: () => void
  onHover: (index: number) => void
}) {
  const t = useTranslations("aiChat")
  const tMention = useTranslations("aiChat.mention")
  const label = categoryLabel(def, tMention)
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
        <button
          type="button"
          aria-label={t("mention.back")}
          onMouseDown={(e) => {
            e.preventDefault()
            onBack()
          }}
          className="grid size-6 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4 rtl:rotate-180" />
        </button>
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md",
            def.tint,
          )}
        >
          <def.Icon className={cn("size-3.5", def.color)} />
        </span>
        <span className="truncate text-[13px] font-semibold">{label}</span>
      </div>

      {/* The listbox is mounted even with nothing in it. The picker is open in
          this state — it just has no rows yet — and the composer's
          `aria-controls` names this element, so replacing it with a bare div
          would leave that relationship pointing at nothing on exactly the
          screens (loading, no matches, load failed) where a screen reader user
          most needs to be told what happened. The two panels sit inside it as
          a presentational row instead. */}
      <ul
        ref={listRef}
        role="listbox"
        id={listboxId}
        aria-label={label}
        className={cn(
          candidates.length > 0 &&
            "max-h-[min(236px,38vh)] overflow-y-auto p-1.5",
        )}
      >
        {candidates.length === 0 ? (
          <li role="presentation">
            {loading ? (
              <SkeletonRows />
            ) : (
              <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                <SearchXIcon className="size-5 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">
                  {failed ? t("mention.loadFailed") : t("mention.noMatches")}
                </span>
              </div>
            )}
          </li>
        ) : (
          candidates.map((c, i) => (
            <Row
              key={`${c.type}:${c.id}`}
              id={inlineMentionOptionId(i, listboxId)}
              def={def}
              highlightId={highlightId}
              reduceMotion={reduceMotion}
              title={c.display}
              secondary={c.secondary}
              active={i === activeIndex}
              onHover={() => onHover(i)}
              onPick={() => onPick(c)}
            />
          ))
        )}
      </ul>
    </>
  )
}

/* --------------------------------- pieces --------------------------------- */

function Row({
  id,
  def,
  title,
  secondary,
  active,
  highlightId,
  reduceMotion,
  onHover,
  onPick,
  trailing,
}: {
  /** What the composer's `aria-activedescendant` names while this row is the
   *  active one. */
  id: string
  def: MentionCategoryDef
  title: string
  secondary?: string
  active: boolean
  highlightId: string
  reduceMotion: boolean
  onHover: () => void
  onPick: () => void
  trailing?: React.ReactNode
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(e) => {
        // mousedown, not click — the textarea keeps focus, so the splice and
        // the caret restore happen without a focus round-trip.
        e.preventDefault()
        onPick()
      }}
      className="relative cursor-pointer"
    >
      {active && (
        <motion.div
          layoutId={highlightId}
          aria-hidden
          className="absolute inset-0 rounded-lg bg-muted"
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 620, damping: 40, mass: 0.5 }
          }
        />
      )}
      <div className="relative flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md",
            def.tint,
          )}
        >
          <def.Icon className={cn("size-3.5", def.color)} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight">
            {title}
          </div>
          {secondary && (
            <div className="truncate text-[11px] leading-tight text-muted-foreground">
              {secondary}
            </div>
          )}
        </div>
        {trailing ?? (
          <kbd
            className={cn(
              "inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[10px] leading-none text-muted-foreground transition-opacity",
              active ? "opacity-100" : "opacity-0",
            )}
          >
            ↵
          </kbd>
        )}
      </div>
    </li>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
      {children}
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-0.5 p-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="size-7 shrink-0 animate-pulse rounded-md bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-border bg-muted px-1 py-px font-sans text-[9px] leading-none text-foreground/70">
        {keys}
      </kbd>
      {label}
    </span>
  )
}
