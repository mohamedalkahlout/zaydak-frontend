"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/shared/lib/utils"
import { useSafeReducedMotion } from "@repo/ui/hooks/use-hydrated"
import type { MentionCandidate } from "@/features/ai/lib/use-mention-search"
import {
  MENTION_CATEGORIES,
  categoryLabel,
  mentionCategory,
  type MentionCategoryDef,
  type MentionType,
} from "@/features/ai/lib/mention-config"

interface Props {
  /** `null` = root category menu; otherwise the drilled-in category. */
  category: MentionType | null
  candidates: MentionCandidate[]
  activeIndex: number
  loading: boolean
  /** Which way the chevrons point. */
  locale: "ar" | "en"
  onPickCategory: (key: MentionType) => void
  onPickCandidate: (candidate: MentionCandidate) => void
  onBack: () => void
  onHover: (index: number) => void
}

/**
 * Hierarchical @-mention picker rendered as a floating popup above the chat
 * composer (Shopify Sidekick pattern). Two levels:
 *
 *   root      → a list of categories (Products, Collections, Orders, …)
 *   category  → a back header + that category's entity search results
 *
 * Keyboard nav lives in the parent hook (`use-mention-composer`); this
 * component is presentational and reports clicks/hover only.
 */
export function MentionDropdown({
  category,
  candidates,
  activeIndex,
  loading,
  locale,
  onPickCategory,
  onPickCandidate,
  onBack,
  onHover,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const reduceMotion = useSafeReducedMotion()

  // Keep the highlighted row in view as the user arrows a long list.
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      style={{ transformOrigin: "bottom center" }}
      className="overflow-hidden rounded-2xl border border-border/70 bg-popover/95 shadow-lg shadow-black/8 ring-1 ring-black/5 backdrop-blur-sm">
      {category === null ? (
        <RootMenu
          activeIndex={activeIndex}
          locale={locale}
          listRef={listRef}
          onPick={onPickCategory}
          onHover={onHover}
        />
      ) : (
        <CategoryMenu
          def={mentionCategory(category)}
          candidates={candidates}
          activeIndex={activeIndex}
          loading={loading}
          locale={locale}
          listRef={listRef}
          onPick={onPickCandidate}
          onBack={onBack}
          onHover={onHover}
        />
      )}
      <KeyboardHints inCategory={category !== null} />
    </motion.div>
  )
}

/* -------------------------------- root menu ------------------------------- */

function RootMenu({
  activeIndex,
  locale,
  listRef,
  onPick,
  onHover,
}: {
  activeIndex: number
  locale: "ar" | "en"
  listRef: React.RefObject<HTMLUListElement | null>
  onPick: (key: MentionType) => void
  onHover: (index: number) => void
}) {
  const t = useTranslations("aiChat.mention")
  const Chevron = locale === "ar" ? ChevronLeftIcon : ChevronRightIcon
  return (
    <>
      <SectionLabel>{t("addReference")}</SectionLabel>
      <ul ref={listRef} role="listbox" className="p-1.5 pt-1">
        {MENTION_CATEGORIES.map((def, i) => (
          <Row
            key={def.key}
            def={def}
            title={categoryLabel(def, t)}
            active={i === activeIndex}
            onHover={() => onHover(i)}
            onPick={() => onPick(def.key)}
            trailing={
              <Chevron
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  i === activeIndex
                    ? "text-foreground/70"
                    : "text-muted-foreground/40",
                )}
              />
            }
          />
        ))}
      </ul>
    </>
  )
}

/* ----------------------------- category level ----------------------------- */

function CategoryMenu({
  def,
  candidates,
  activeIndex,
  loading,
  locale,
  listRef,
  onPick,
  onBack,
  onHover,
}: {
  def: MentionCategoryDef
  candidates: MentionCandidate[]
  activeIndex: number
  loading: boolean
  locale: "ar" | "en"
  listRef: React.RefObject<HTMLUListElement | null>
  onPick: (c: MentionCandidate) => void
  onBack: () => void
  onHover: (index: number) => void
}) {
  const t = useTranslations("aiChat.mention")
  const Back = locale === "ar" ? ChevronRightIcon : ChevronLeftIcon
  return (
    <>
      {/* Back header — click returns to the root category list. */}
      <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
        <button
          type="button"
          aria-label={t("back")}
          onMouseDown={(e) => {
            e.preventDefault()
            onBack()
          }}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Back className="size-4" />
        </button>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg",
            def.tint,
          )}>
          <def.Icon className={cn("size-4", def.color)} />
        </span>
        <span className="text-sm font-semibold">{categoryLabel(def, t)}</span>
        {candidates.length > 0 && (
          <span className="ms-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {candidates.length}
          </span>
        )}
      </div>

      {candidates.length === 0 ? (
        loading ? (
          <SkeletonRows />
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-3 py-7 text-center">
            <SearchXIcon className="size-5 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">
              {t("noMatches")}
            </span>
          </div>
        )
      ) : (
        <ul
          ref={listRef}
          role="listbox"
          className="max-h-[min(300px,42vh)] overflow-y-auto p-1.5">
          {candidates.map((c, i) => (
            <Row
              key={`${c.type}:${c.id}`}
              def={def}
              title={c.display}
              secondary={c.secondary}
              active={i === activeIndex}
              onHover={() => onHover(i)}
              onPick={() => onPick(c)}
            />
          ))}
        </ul>
      )}
    </>
  )
}

/* --------------------------------- pieces --------------------------------- */

function Row({
  def,
  title,
  secondary,
  active,
  onHover,
  onPick,
  trailing,
}: {
  def: MentionCategoryDef
  title: string
  secondary?: string
  active: boolean
  onHover: () => void
  onPick: () => void
  trailing?: React.ReactNode
}) {
  return (
    <li
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(e) => {
        // mousedown, not click — keep the textarea focused so we can insert
        // the chip / drill in without a focus round-trip.
        e.preventDefault()
        onPick()
      }}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors",
        active ? "bg-muted" : "hover:bg-muted/60",
      )}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          def.tint,
        )}>
        <def.Icon className={cn("size-4", def.color)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium leading-tight">
          {title}
        </div>
        {secondary && (
          <div className="truncate text-[11px] leading-tight text-muted-foreground">
            {secondary}
          </div>
        )}
      </div>
      {trailing}
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
          <div className="size-8 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function KeyboardHints({ inCategory }: { inCategory: boolean }) {
  const t = useTranslations("aiChat.mention")
  return (
    <div className="hidden items-center gap-3 border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground sm:flex">
      <Hint keys="↑↓" label={t("navigate")} />
      <Hint keys="↵" label={inCategory ? t("select") : t("open")} />
      <Hint keys="esc" label={t("close")} />
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
