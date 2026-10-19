"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { BanIcon, SearchIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { foldSearch } from "@/shared/geo"
import { countriesFor, countryLabel } from "./_data/countries"

interface CountriesPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string[]
  onConfirm: (codes: string[]) => void
  maxSelection?: number
}

/**
 * Static ISO-3166 multi-select. MENA/GCC pinned to the top since most
 * shops start there; rest alphabetical in the active locale. Search matches
 * the name as shown, the English name (so Latin typing still works on the
 * Arabic dashboard), or the code.
 */
export function CountriesPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  maxSelection = 250,
}: CountriesPickerDialogProps) {
  const t = useTranslations("coupons")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(value))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(new Set(value))
  }

  const visible = useMemo(() => {
    const all = countriesFor(locale)
    const q = foldSearch(search.trim())
    if (!q) return all
    return all.filter(
      (c) =>
        foldSearch(countryLabel(c.code, locale)).includes(q) ||
        foldSearch(countryLabel(c.code, "en")).includes(q) ||
        c.code.toLowerCase().includes(q),
    )
  }, [search, locale])

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else if (next.size < maxSelection) {
        next.add(code)
      }
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selected))
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelected(new Set(value))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl grid-rows-[auto_auto_1fr_auto] h-[min(80vh,640px)] p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t("countryPicker.title")}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("countryPicker.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <BanIcon className="size-8 stroke-[1.5]" />
              <p>{t("countryPicker.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((c) => {
                const checked = selected.has(c.code)
                return (
                  <li key={c.code}>
                    <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(c.code)}
                      />
                      <span className="text-lg leading-none" aria-hidden>
                        {c.flag}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {countryLabel(c.code, locale)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.code}
                        </p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {t("countryPicker.selected", { count: selected.size })}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              {t("pickers.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { countryLabel }
