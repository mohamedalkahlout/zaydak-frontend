"use client"

import { useQuery } from "@apollo/client/react"
import { Check } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@repo/ui/lib/utils"

import Image from "@/shared/components/app-image"

import { PUBLIC_SHOPS, directoryVariables } from "../api"

const BADGE_COUNT = 7

/** Soft sky-family fills so logo-less shops read as real marks, not identical blanks. */
const INITIAL_TONES = [
  "bg-sky-100 text-sky-800",
  "bg-cyan-100 text-cyan-900",
  "bg-blue-100 text-blue-800",
  "bg-indigo-100 text-indigo-800",
  "bg-slate-100 text-slate-700",
  "bg-teal-100 text-teal-800",
  "bg-violet-100 text-violet-800",
] as const

type ShopBadge = {
  id: string
  name: string
  logoSrc: string | null
}

/**
 * Social proof for the cloud-shader hero: a logo fan perched on the top edge
 * of one frosted count pill — white / sky / glass, matching the hero CTAs.
 *
 * Logos reuse `PUBLIC_SHOPS` (preloaded on `/`): prefer shops with a logo, then
 * name initials with a stable soft fill. No third-party brand marks are invented.
 */
export function HeroSocialProof({ className }: { className?: string }) {
  const t = useTranslations("landing")
  const { data } = useQuery(PUBLIC_SHOPS, {
    variables: directoryVariables(""),
    errorPolicy: "all",
  })

  const badges = pickBadges(data?.shops.data ?? [])

  return (
    <div className={cn("mx-auto w-full max-w-xl", className)}>
      <div className="relative mx-auto flex w-fit max-w-full flex-col items-center">
        {/* Fan sits on the pill’s top edge — not a second white capsule */}
        <ul
          aria-hidden
          className="relative z-20 mb-[-1.4rem] flex items-center px-0.5 sm:mb-[-1.55rem]"
        >
          {badges.map((shop, index) => (
            <li
              key={shop.id}
              className={cn(
                "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full shadow-md ring-2 ring-white sm:size-10",
                index > 0 && "-ms-2.5 sm:-ms-3",
                index >= 5 && "hidden sm:grid",
                shop.logoSrc ? "bg-white" : toneFor(shop.id),
              )}
              style={{ zIndex: index + 1 }}
            >
              {shop.logoSrc ? (
                <Image
                  src={shop.logoSrc}
                  alt=""
                  width={40}
                  height={40}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-[0.65rem] font-bold tracking-tight sm:text-xs">
                  {initialOf(shop.name)}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* <div className="relative z-10 flex max-w-full items-center gap-2 rounded-full border border-white/50 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md sm:gap-2.5 sm:px-5 sm:py-2.5">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-50 shadow-sm ring-1 ring-sky-700/15 sm:size-7"
          >
            <Check
              className="size-3 text-sky-700 sm:size-3.5"
              strokeWidth={3}
            />
          </span>
          <p className="min-w-0 text-start text-[0.7rem] font-semibold leading-snug text-sky-800 sm:text-sm">
            {t("heroSocialProof")}
          </p>
        </div> */}
      </div>
    </div>
  )
}

function pickBadges(
  shops: Array<{
    id: string
    name: string
    logo?: { thumbnail?: string | null; original?: string | null } | null
  }>,
): ShopBadge[] {
  const withLogo: ShopBadge[] = []
  const withoutLogo: ShopBadge[] = []
  const seenInitials = new Set<string>()

  for (const shop of shops) {
    const logoSrc = shop.logo?.thumbnail ?? shop.logo?.original ?? null
    const entry = { id: shop.id, name: shop.name, logoSrc }
    if (logoSrc) {
      withLogo.push(entry)
      continue
    }
    const initial = initialOf(shop.name)
    // Prefer a varied initial row when logos are missing.
    if (seenInitials.has(initial) && withoutLogo.length >= 2) continue
    seenInitials.add(initial)
    withoutLogo.push(entry)
  }

  const chosen = [...withLogo, ...withoutLogo].slice(0, BADGE_COUNT)

  const fillers = ["Z", "A", "Y", "D", "K", "S", "M"]
  while (chosen.length < BADGE_COUNT) {
    const n = chosen.length
    const letter = fillers[n % fillers.length]!
    chosen.push({
      id: `placeholder-${n}`,
      name: letter,
      logoSrc: null,
    })
  }

  return chosen
}

function initialOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  return Array.from(trimmed)[0]!.toLocaleUpperCase()
}

function toneFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % 997
  }
  return INITIAL_TONES[hash % INITIAL_TONES.length]!
}
