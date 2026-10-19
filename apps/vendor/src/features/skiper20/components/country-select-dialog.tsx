"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { CheckIcon, SearchIcon, XIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
} from "@repo/ui/components/dialog"
import { cn } from "@/shared/lib/utils"
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type SupportedLocale,
} from "@/shared/i18n/config"
import { useChangeLocale } from "@/shared/i18n/client"

const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  en: "https://flagcdn.com/gb.svg",
  ar: "https://flagcdn.com/sa.svg",
}

interface LanguageSelectDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function LanguageSelectDialog({
  isOpen,
  onClose,
}: LanguageSelectDialogProps) {
  const t = useTranslations("locale.dialog")
  const [search, setSearch] = useState("")
  const { locale: currentLocale, change: changeLocale } = useChangeLocale()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return [...SUPPORTED_LOCALES]
    return SUPPORTED_LOCALES.filter(
      (l) =>
        LOCALE_LABELS[l].toLowerCase().includes(q) || l.includes(q),
    )
  }, [search])

  const handleSelect = (locale: SupportedLocale) => {
    changeLocale(locale)
    onClose()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <div className="relative border-b border-border/40">
          <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full border-0 bg-transparent py-4 ps-11 pe-12 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground">
              <p>{t("noResults")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40" role="listbox">
              {filtered.map((locale) => {
                const isSelected = locale === currentLocale
                return (
                  <li key={locale} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => handleSelect(locale)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors",
                        isSelected
                          ? "bg-accent"
                          : "hover:bg-accent/50",
                      )}
                    >
                      <div className="size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-border/20">
                        <img
                          src={LOCALE_FLAGS[locale]}
                          alt={LOCALE_LABELS[locale]}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {LOCALE_LABELS[locale]}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckIcon className="size-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
