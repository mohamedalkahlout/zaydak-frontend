"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Lock, Plus } from "lucide-react"

import { Button } from "@repo/ui/components/button"

import { orderedSections } from "../lib/layout-validation"
import { useThemeEditorStore } from "../state/theme-editor-store"
import { AddSectionDialog } from "./add-section-dialog"
import { SectionTreeItem } from "./section-tree-item"

export function SectionTree() {
  const t = useTranslations("themeEditor")
  const layout = useThemeEditorStore((s) => s.layout)
  const sections = orderedSections(layout)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/80 bg-muted/40">
        <p className="px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {t("pageStructure")}
        </p>
        <StructureChrome title={t("header")} hint={t("headerPlaceholder")} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <p className="mb-2 px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {t("template")}
        </p>
        <div className="flex flex-col gap-0.5">
          {sections.map((section, index) => (
            <SectionTreeItem
              key={section.id}
              section={section}
              index={index}
              total={sections.length}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full justify-start gap-2 border-dashed text-sm"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          {t("addSection")}
        </Button>
      </div>
      <div className="shrink-0 border-t border-border/80 bg-muted/40">
        <StructureChrome title={t("footer")} hint={t("footerPlaceholder")} />
      </div>
      <AddSectionDialog open={addOpen} onOpenChange={setAddOpen} />
    </aside>
  )
}

function StructureChrome({
  title,
  hint,
}: {
  title: string
  hint: string
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <span className="mt-px grid size-7 shrink-0 place-items-center rounded-md bg-background text-muted-foreground ring-1 ring-foreground/10">
        <Lock className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-5">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      </div>
    </div>
  )
}
