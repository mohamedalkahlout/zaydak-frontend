"use client"

import { useTranslations } from "next-intl"
import {
  AlignLeftIcon,
  CheckIcon,
  ImageIcon,
  LinkIcon,
  PaletteIcon,
  SquareIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useGeneralForm } from "./general-form-provider"
import { BRAND_ANCHORS, type BrandAnchor } from "../lib/brand-anchors"

/**
 * The card the Brand screen opens with: a picture of what these assets are for,
 * then the checklist of what fills them.
 *
 * Shopify's version is a static list. Ours ticks the rows that are already set,
 * because the pane below it is eight collapsed slots and "what is still missing"
 * is otherwise only answerable by scrolling the whole screen. Each row scrolls
 * to the group that fills it — a link rather than a jump target, since the pane
 * scrolls inside the settings overlay and not the document.
 */
export function BrandChecklist() {
  const t = useTranslations("settings.brand")
  const { form } = useGeneralForm()
  const v = form.watch()

  const essential: ChecklistItem[] = [
    { icon: ImageIcon, label: t("defaultLogo"), done: !!v.logo, to: "logos" },
    { icon: SquareIcon, label: t("squareLogo"), done: !!v.squareLogo, to: "logos" },
    {
      icon: PaletteIcon,
      label: t("colors"),
      done: !!(v.primaryBackground || v.secondaryBackground),
      to: "colors",
    },
  ]

  const additional: ChecklistItem[] = [
    { icon: ImageIcon, label: t("coverImage"), done: !!v.coverImage, to: "cover" },
    { icon: TypeIcon, label: t("slogan"), done: !!v.slogan.trim(), to: "slogan" },
    {
      icon: AlignLeftIcon,
      label: t("shortDescription"),
      done: !!v.description.trim(),
      to: "description",
    },
    {
      icon: LinkIcon,
      label: t("socialLinks"),
      done: Object.values(v.socials).some((link) => link.trim()),
      to: "socials",
    },
  ]

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <BrandArtwork />

      <div className="p-4">
        <h2 className="font-heading text-base leading-snug font-medium">
          {t("whatToAdd")}
        </h2>

        <Group title={t("essential")} description={t("essentialDesc")} items={essential} />
        <Group title={t("additional")} description={t("additionalDesc")} items={additional} />
      </div>
    </section>
  )
}

interface ChecklistItem {
  icon: LucideIcon
  label: string
  done: boolean
  to: BrandAnchor
}

function Group({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: ChecklistItem[]
}) {
  return (
    <div className="mt-4 first-of-type:mt-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-2 flex flex-col">
        {items.map((item) => (
          <li key={`${item.to}-${item.label}`}>
            <button
              type="button"
              onClick={() => scrollToGroup(item.to)}
              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-muted/60"
            >
              <item.icon
                aria-hidden
                className={cn(
                  "size-4 shrink-0",
                  item.done ? "text-foreground" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
              {item.done && (
                <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function scrollToGroup(anchor: BrandAnchor) {
  document
    .getElementById(BRAND_ANCHORS[anchor])
    ?.scrollIntoView({ behavior: "smooth", block: "start" })
}

/**
 * The header illustration: a storefront with a logo dropped on it, drawn in
 * plain elements rather than shipped as an asset.
 *
 * It is decoration with no information in it, so it costs no request, no
 * `next/image` host allow-listing and no second file for dark mode — it is
 * built out of the same tokens as the card it sits in, and `aria-hidden`
 * because there is nothing here to read out.
 */
function BrandArtwork() {
  return (
    <div
      aria-hidden
      className="relative h-52 overflow-hidden bg-linear-to-b from-muted/70 to-card"
    >
      {/* The storefront page */}
      <div className="absolute start-1/2 top-7 h-44 w-[19rem] -translate-x-1/2 overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-foreground/10 rtl:translate-x-1/2">
        <div className="flex items-center gap-1 px-3 py-2.5">
          <span className="size-1.5 rounded-full bg-foreground/15" />
          <span className="size-1.5 rounded-full bg-foreground/15" />
          <span className="size-1.5 rounded-full bg-foreground/15" />
        </div>
        <div className="flex items-center justify-between gap-3 px-3">
          <span className="h-5 w-24 rounded-sm bg-foreground/8" />
          <span className="h-5 w-16 rounded-full bg-foreground/8" />
        </div>
        <div className="mx-3 mt-3 h-24 rounded-t-sm bg-foreground/5" />
      </div>

      {/* The brand asset being placed on it */}
      <div className="absolute start-[calc(50%-9.5rem)] top-[7.25rem] h-28 w-[10.5rem] rounded-lg bg-card p-3 shadow-md ring-1 ring-foreground/10">
        <span className="block size-9 rounded-full bg-foreground/10" />
        <span className="mt-3 block h-2.5 w-20 rounded-full bg-foreground/8" />
        <span className="mt-2 block h-2.5 w-12 rounded-full bg-foreground/8" />
      </div>
    </div>
  )
}
