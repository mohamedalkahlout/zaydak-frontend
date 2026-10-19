"use client"

import { useMemo, useState } from "react"
import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { PlusIcon, SearchIcon, TagIcon } from "lucide-react"
import { GET_TAGS } from "@/features/tags/api"
import type { Tag, TagsResponse } from "@/features/tags/types"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { translatable } from "@/shared/lib/format"
import { TagFormDialog } from "./tag-form-dialog"
import { TagRowActions } from "./tag-row-actions"

export function TagsView() {
  const t = useTranslations("tags")
  const [query, setQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)

  const { data } = useSuspenseQuery<TagsResponse>(GET_TAGS, {
    variables: { page: 1, limit: 100 },
  })

  const allTags: Tag[] = useMemo(() => data?.tags?.data ?? [], [data])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allTags
    return allTags.filter((t) => {
      const name = translatable(t.name).toLowerCase()
      return name.includes(q) || t.slug.toLowerCase().includes(q)
    })
  }, [allTags, query])

  const isEmpty = allTags.length === 0

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" /> {t("new")}
        </Button>
      </header>

      {isEmpty ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <SearchIcon className="size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="h-8 border-0 bg-transparent px-0 focus-visible:ring-0"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("noMatch", { query })}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((tag) => (
                <TagRow key={tag.id} tag={tag} />
              ))}
            </ul>
          )}
        </div>
      )}

      <TagFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}

function TagRow({ tag }: { tag: Tag }) {
  const t = useTranslations("tags")
  const name = translatable(tag.name) || tag.slug

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <TagIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">/{tag.slug}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {typeof tag.products_count === "number" && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("productCount", { count: tag.products_count })}
          </span>
        )}
        <TagRowActions tag={tag} />
      </div>
    </li>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("tags")
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TagIcon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-medium">{t("emptyTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("emptyBody")}</p>
      </div>
      <Button size="sm" onClick={onCreate}>
        <PlusIcon className="size-4" /> {t("createFirst")}
      </Button>
    </div>
  )
}
