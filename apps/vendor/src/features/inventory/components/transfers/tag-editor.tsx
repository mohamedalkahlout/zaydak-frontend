"use client"

import { useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Search, Check, X, Plus } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { Input } from "@repo/ui/components/input"

/**
 * Shopify-style tag editor popover. We have no global transfer-tag catalog, so
 * it's a type-to-create surface: the search box doubles as the create input
 * ("Create '<query>'"), and currently-applied tags list below as removable,
 * checked rows. `suggestions` (optional) seeds the list from known tags.
 */
export function TagEditor({
  tags,
  onChange,
  trigger,
  suggestions = [],
}: {
  tags: string[]
  onChange: (next: string[]) => void
  trigger: ReactNode
  suggestions?: string[]
}) {
  const t = useTranslations("transfers.detailsCard")
  const [query, setQuery] = useState("")

  const add = (raw: string) => {
    const v = raw.trim()
    if (!v) return
    if (!tags.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...tags, v])
    }
    setQuery("")
  }
  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag))
  const toggle = (tag: string) =>
    tags.some((x) => x.toLowerCase() === tag.toLowerCase())
      ? remove(tags.find((x) => x.toLowerCase() === tag.toLowerCase())!)
      : add(tag)

  const q = query.trim().toLowerCase()
  const pool = [...new Set([...tags, ...suggestions])]
  const filtered = pool.filter((x) => !q || x.toLowerCase().includes(q))
  const exact = pool.some((x) => x.toLowerCase() === q)

  return (
    <Popover>
      <PopoverTrigger render={trigger as never} />
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  add(query)
                }
              }}
              placeholder={t("tagsPlaceholder")}
              className="h-8 ps-8"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {q && !exact && (
            <button
              type="button"
              onClick={() => add(query)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
            >
              <Plus className="size-3.5" />
              {`“${query.trim()}”`}
            </button>
          )}
          {filtered.length === 0 && !q ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t("noTags")}
            </p>
          ) : (
            filtered.map((tag) => {
              const on = tags.some((x) => x.toLowerCase() === tag.toLowerCase())
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                >
                  <span className="truncate">{tag}</span>
                  {on && <Check className="size-3.5 text-foreground" />}
                </button>
              )
            })
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-border p-2">
            {tags.map((tg) => (
              <span
                key={tg}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {tg}
                <button
                  type="button"
                  onClick={() => remove(tg)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
