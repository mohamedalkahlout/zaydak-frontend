"use client"

import { useState } from "react"
import { BookmarkIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import {
  MAX_SAVED_VIEWS,
  queryStateFromSnapshot,
  useSavedViews,
} from "@/features/abandoned-carts/lib/saved-views"
import type { AbandonedCartsQueryState } from "@/features/abandoned-carts/lib/query-state"

export function AbandonedCartsSavedViews({
  shopSlug,
  state,
  onApply,
}: {
  shopSlug: string
  state: AbandonedCartsQueryState
  onApply: (next: AbandonedCartsQueryState) => void
}) {
  const t = useTranslations("abandonedCarts.savedViews")
  const { views, save, remove } = useSavedViews(shopSlug)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  const atLimit = views.length >= MAX_SAVED_VIEWS

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <Button
              {...props}
              variant="ghost"
              size="icon-sm"
              aria-label={t("label")}
            >
              <BookmarkIcon className="size-4" />
            </Button>
          )}
        />
        <DropdownMenuContent align="start" className="w-[220px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
            {views.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              views.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  className="justify-between gap-2"
                  onClick={() => onApply(queryStateFromSnapshot(view.params))}
                >
                  <span className="min-w-0 truncate">{view.name}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-destructive"
                    aria-label={t("delete", { name: view.name })}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      remove(view.id)
                    }}
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={atLimit}
            onClick={() => {
              setName("")
              setNaming(true)
            }}
          >
            {atLimit ? t("limit") : t("saveCurrent")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("saveCurrent")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="abandoned-carts-view-name">{t("name")}</Label>
            <Input
              id="abandoned-carts-view-name"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                const view = save(name, state)
                if (view) setNaming(false)
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                const view = save(name, state)
                if (view) setNaming(false)
              }}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
