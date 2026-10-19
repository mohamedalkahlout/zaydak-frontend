"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Check, Search, X } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { cn } from "@repo/ui/lib/utils"

import { MOCK_COLLECTIONS } from "../mocks/mock-collections"
import { MOCK_TAGS } from "../mocks/mock-tags"

export function CollectionChips({
  ids,
  onChange,
  multiple = true,
}: {
  ids: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
}) {
  const t = useTranslations("themeEditor")
  const [open, setOpen] = useState(false)
  const selected = MOCK_COLLECTIONS.filter((item) => ids.includes(item.id))

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {selected.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm ring-1 ring-foreground/8"
            >
              <span className="truncate">{item.title}</span>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label={t("removeItem", { name: item.title })}
                onClick={() => onChange(ids.filter((id) => id !== item.id))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {selected.length ? t("change") : t("selectCollections")}
      </Button>
      <PickerDialog
        open={open}
        onOpenChange={setOpen}
        title={t("selectCollection")}
        items={MOCK_COLLECTIONS}
        selectedIds={ids}
        multiple={multiple}
        onConfirm={(next) => {
          onChange(next)
          setOpen(false)
        }}
      />
    </div>
  )
}

export function TagChips({
  ids,
  onChange,
}: {
  ids: string[]
  onChange: (ids: string[]) => void
}) {
  const t = useTranslations("themeEditor")
  const [open, setOpen] = useState(false)
  const selected = MOCK_TAGS.filter((item) => ids.includes(item.id))

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <li
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs ring-1 ring-foreground/8"
            >
              {item.title}
              <button
                type="button"
                aria-label={t("removeItem", { name: item.title })}
                onClick={() => onChange(ids.filter((id) => id !== item.id))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("selectTags")}
      </Button>
      <PickerDialog
        open={open}
        onOpenChange={setOpen}
        title={t("selectTags")}
        items={MOCK_TAGS}
        selectedIds={ids}
        multiple
        onConfirm={(next) => {
          onChange(next)
          setOpen(false)
        }}
      />
    </div>
  )
}

function PickerDialog({
  open,
  onOpenChange,
  title,
  items,
  selectedIds,
  multiple,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  items: { id: string; title: string }[]
  selectedIds: string[]
  multiple: boolean
  onConfirm: (ids: string[]) => void
}) {
  const t = useTranslations("themeEditor")
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState(selectedIds)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) => item.title.toLowerCase().includes(needle))
  }, [items, query])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(selectedIds)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
          {filtered.map((item) => {
            const selected = draft.includes(item.id)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2.5 text-start text-sm hover:bg-muted/60",
                    selected && "bg-muted",
                  )}
                  onClick={() => {
                    if (multiple) {
                      setDraft(
                        selected
                          ? draft.filter((id) => id !== item.id)
                          : [...draft, item.id],
                      )
                    } else {
                      setDraft(selected ? [] : [item.id])
                    }
                  }}
                >
                  {item.title}
                  {selected ? <Check className="size-4" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => onConfirm(draft)}>
            {t("done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
