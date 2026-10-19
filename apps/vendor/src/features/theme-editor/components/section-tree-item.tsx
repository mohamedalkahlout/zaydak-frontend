"use client"

import { useTranslations } from "next-intl"
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Trash2,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@repo/ui/lib/utils"

import { canDuplicate, canRemove } from "../lib/layout-validation"
import { sectionTitleKey } from "../lib/section-title"
import { useThemeEditorStore } from "../state/theme-editor-store"
import type { StoreSectionInstance } from "../types"

export function SectionTreeItem({
  section,
  index,
  total,
}: {
  section: StoreSectionInstance
  index: number
  total: number
}) {
  const t = useTranslations("themeEditor")
  const selected = useThemeEditorStore((s) => s.selectedSectionId === section.id)
  const selectSection = useThemeEditorStore((s) => s.selectSection)
  const toggleSection = useThemeEditorStore((s) => s.toggleSection)
  const moveSection = useThemeEditorStore((s) => s.moveSection)
  const duplicateSection = useThemeEditorStore((s) => s.duplicateSection)
  const removeSection = useThemeEditorStore((s) => s.removeSection)

  return (
    <div
      className={cn(
        "group flex items-center gap-0.5 rounded-lg px-1 py-0.5",
        selected
          ? "bg-muted ring-1 ring-foreground/10"
          : "hover:bg-muted/60",
        section.disabled && "opacity-60",
      )}
    >
      <span className="grid size-7 place-items-center text-muted-foreground" aria-hidden>
        <GripVertical className="size-3.5" />
      </span>
      <button
        type="button"
        onClick={() => selectSection(section.id)}
        aria-current={selected ? "true" : undefined}
        className="min-w-0 flex-1 truncate rounded-md px-1 py-1.5 text-start text-sm font-medium"
      >
        {t(`titles.${sectionTitleKey(section)}`)}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7"
        aria-pressed={!section.disabled}
        aria-label={
          section.disabled ? t("showSection") : t("hideSection")
        }
        onClick={() => toggleSection(section.id)}
      >
        {section.disabled ? (
          <EyeOff className="size-3.5" />
        ) : (
          <Eye className="size-3.5" />
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <Button
              {...props}
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7"
              aria-label={t("sectionMenu")}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem
            disabled={index === 0}
            onClick={() => moveSection(section.id, -1)}
          >
            {t("moveUp")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === total - 1}
            onClick={() => moveSection(section.id, 1)}
          >
            {t("moveDown")}
          </DropdownMenuItem>
          {canDuplicate(section) && (
            <DropdownMenuItem onClick={() => duplicateSection(section.id)}>
              <Copy />
              {t("duplicate")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => toggleSection(section.id)}>
            {section.disabled ? t("showSection") : t("hideSection")}
          </DropdownMenuItem>
          {canRemove(section) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => removeSection(section.id)}
              >
                <Trash2 />
                {t("remove")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
