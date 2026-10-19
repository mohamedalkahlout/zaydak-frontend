"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Calendar, FileText, StickyNote, Hash } from "lucide-react"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { cn } from "@/shared/lib/utils"
import { TagEditor } from "./tag-editor"

/**
 * Shopify's transfer "details" card — date, reference name, note, and tags as
 * inline-editable rows. Fully controlled: the parent owns persistence. Inline
 * editors stage every keystroke up to the parent, so the contextual save bar
 * reacts on the first change (the form accumulates into local state and saves
 * on submit; the detail page stages into a draft and saves via the save bar).
 */
export function DetailsCard({
  date,
  reference,
  onChangeReference,
  note,
  onChangeNote,
  tags,
  onChangeTags,
  locale,
  readOnly = false,
}: {
  date: Date
  reference: string
  onChangeReference: (v: string) => void
  note: string
  onChangeNote: (v: string) => void
  tags: string[]
  onChangeTags: (v: string[]) => void
  locale: string
  readOnly?: boolean
}) {
  const t = useTranslations("transfers.detailsCard")
  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      <Row icon={<Calendar className="size-4" />}>
        <span className="rounded-md bg-muted/60 px-2 py-1 text-sm">
          {date.toLocaleDateString(locale, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </Row>
      <Row icon={<FileText className="size-4" />}>
        <InlineText
          value={reference}
          placeholder={t("addReference")}
          onCommit={onChangeReference}
          readOnly={readOnly}
        />
      </Row>
      <Row icon={<StickyNote className="size-4" />}>
        <InlineText
          value={note}
          placeholder={t("addNote")}
          onCommit={onChangeNote}
          multiline
          readOnly={readOnly}
        />
      </Row>
      <Row icon={<Hash className="size-4" />}>
        {readOnly ? (
          <TagsInline tags={tags} empty={t("addTags")} />
        ) : (
          <TagEditor
            tags={tags}
            onChange={onChangeTags}
            trigger={
              <button
                type="button"
                className="flex w-full items-center text-start text-sm aria-expanded:text-foreground"
              >
                <TagsInline tags={tags} empty={t("addTags")} />
              </button>
            }
          />
        )}
      </Row>
    </div>
  )
}

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function TagsInline({ tags, empty }: { tags: string[]; empty: string }) {
  if (tags.length === 0)
    return <span className="text-sm text-muted-foreground">{empty}</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((tg) => (
        <span
          key={tg}
          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
        >
          {tg}
        </span>
      ))}
    </span>
  )
}

function InlineText({
  value,
  placeholder,
  onCommit,
  multiline = false,
  readOnly = false,
}: {
  value: string
  placeholder: string
  onCommit: (v: string) => void
  multiline?: boolean
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  // Value when the current edit began — Escape reverts the staged change to it.
  const [start, setStart] = useState(value)

  if (readOnly) {
    return (
      <span
        className={cn(
          "text-sm",
          !value && "text-muted-foreground",
        )}
      >
        {value || placeholder}
      </span>
    )
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value)
          setStart(value)
          setEditing(true)
        }}
        className={cn(
          "w-full text-start text-sm",
          value ? "whitespace-pre-wrap" : "text-muted-foreground",
        )}
      >
        {value || placeholder}
      </button>
    )
  }

  // Stage every keystroke so the contextual save bar reacts on the first
  // change (not on blur). Blur/Enter just exit edit mode — the value is
  // already staged; Escape reverts the staged change to where editing began.
  const change = (v: string) => {
    setDraft(v)
    onCommit(v)
  }
  const exit = () => setEditing(false)
  const revert = () => {
    setDraft(start)
    onCommit(start)
    setEditing(false)
  }

  if (multiline) {
    return (
      <Textarea
        autoFocus
        rows={2}
        value={draft}
        onChange={(e) => change(e.target.value)}
        onBlur={exit}
        onKeyDown={(e) => {
          if (e.key === "Escape") revert()
        }}
        className="min-h-0 text-sm"
      />
    )
  }
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => change(e.target.value)}
      onBlur={exit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          exit()
        } else if (e.key === "Escape") revert()
      }}
      className="h-8 text-sm"
    />
  )
}
