"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, X, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"

/**
 * Bulk Add / Remove tags across the selected transfers. In add mode the staff
 * compose a tag list to union into each transfer; in remove mode they tick the
 * tags (drawn from the selection's union) to strip. Applying returns the chosen
 * tag list — the list page does the per-transfer union/diff + mutations. The
 * editable state lives in `Body`, which only mounts while the dialog is open so
 * it resets cleanly each time (no reset-in-effect).
 */
export function BulkTagsDialog({
  open,
  onOpenChange,
  mode,
  existingTags,
  applying,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "add" | "remove"
  existingTags: string[]
  applying: boolean
  onApply: (tags: string[]) => void
}) {
  const t = useTranslations("transfers.tagsDialog")

  return (
    <Dialog open={open} onOpenChange={(n) => !applying && onOpenChange(n)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? t("addTitle") : t("removeTitle")}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <Body
            mode={mode}
            existingTags={existingTags}
            applying={applying}
            onApply={onApply}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  mode,
  existingTags,
  applying,
  onApply,
}: {
  mode: "add" | "remove"
  existingTags: string[]
  applying: boolean
  onApply: (tags: string[]) => void
}) {
  const t = useTranslations("transfers.tagsDialog")
  const tCommon = useTranslations("common")
  const [staged, setStaged] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const addStaged = (raw: string) => {
    const v = raw.trim()
    if (!v) return
    setStaged((s) =>
      s.some((x) => x.toLowerCase() === v.toLowerCase()) ? s : [...s, v],
    )
    setInput("")
  }

  const apply = () => onApply(mode === "add" ? staged : [...checked])
  const canApply = mode === "add" ? staged.length > 0 : checked.size > 0

  return (
    <>
      {mode === "add" ? (
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                addStaged(input)
              }
            }}
            placeholder={t("addPlaceholder")}
          />
          {input.trim() &&
            !staged.some(
              (x) => x.toLowerCase() === input.trim().toLowerCase(),
            ) && (
              <button
                type="button"
                onClick={() => addStaged(input)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
              >
                <Plus className="size-3.5" />
                {t("create", { tag: input.trim() })}
              </button>
            )}
          {staged.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {staged.map((tg) => (
                <span
                  key={tg}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {tg}
                  <button
                    type="button"
                    onClick={() => setStaged((s) => s.filter((x) => x !== tg))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {existingTags.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              {t("noTags")}
            </p>
          ) : (
            existingTags.map((tg) => (
              <label
                key={tg}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={checked.has(tg)}
                  onCheckedChange={(on) =>
                    setChecked((s) => {
                      const next = new Set(s)
                      if (on) next.add(tg)
                      else next.delete(tg)
                      return next
                    })
                  }
                />
                {tg}
              </label>
            ))
          )}
        </div>
      )}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" disabled={applying} />}>
          {tCommon("cancel")}
        </DialogClose>
        <Button onClick={apply} disabled={applying || !canApply}>
          {applying && <Loader2 className="size-3.5 animate-spin" />}
          {t("apply")}
        </Button>
      </DialogFooter>
    </>
  )
}
