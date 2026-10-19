"use client"

import { useQuery } from "@apollo/client/react"
import {
  Compass,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { PUBLIC_SHOPS, directoryVariables } from "../api"
import {
  CommunityOrbit,
  type OrbitItem,
  type OrbitStat,
  type OrbitTag,
} from "./community-orbit"

/** Soft fills for logo-less shop discs on the orbit. */
const AVATAR_COLORS = [
  "#c4a574",
  "#7a9e8e",
  "#8b7e74",
  "#6b8cae",
  "#9a7b6a",
  "#5c8a7a",
] as const

const OUTER_ANGLES = [18, 48, 78, 112, 148, 172] as const
const INNER_ANGLES = [32, 68, 105, 142] as const

type DirectoryShop = {
  id: string
  name: string
  products_count?: number | null
  logo?: { thumbnail?: string | null; original?: string | null } | null
}

/**
 * Community orbit for `/`, below the cloud-shader hero.
 *
 * Reuses the preloaded `PUBLIC_SHOPS` cache for logos and counts. Stats fall
 * back to sensible Zaydak placeholders when the directory is empty or the
 * query fails — the band still paints, it just does not invent fake shops.
 */
export function CommunityOrbitSection() {
  const t = useTranslations("landing")
  const { data } = useQuery(PUBLIC_SHOPS, {
    variables: directoryVariables(""),
    errorPolicy: "all",
  })

  const shops = data?.shops.data ?? []
  const shopTotal = data?.shops.meta?.total ?? shops.length
  const productTotal = shops.reduce(
    (sum, shop) => sum + (shop.products_count ?? 0),
    0,
  )

  const items = buildItems(shops, {
    open: t("orbitStatusOpen"),
    browse: t("orbitPillBrowse"),
    local: t("orbitPillLocal"),
  })

  const stats: OrbitStat[] = [
    {
      value: formatCount(Math.max(shopTotal, 1)),
      label: t("orbitStatStores"),
    },
    {
      value: formatCount(Math.max(productTotal, shopTotal > 0 ? productTotal : 12)),
      label: t("orbitStatProducts"),
    },
    {
      value: "1",
      label: t("orbitStatMarketplace"),
    },
  ]

  const tags: OrbitTag[] = [
    {
      icon: <Store className="size-[15px]" strokeWidth={2.2} />,
      label: t("orbitTagBrowse"),
      href: "#shops",
    },
    {
      icon: <Compass className="size-[15px]" strokeWidth={2.2} />,
      label: t("orbitTagVisit"),
      href: "#shops",
    },
    {
      icon: <Users className="size-[15px]" strokeWidth={2.2} />,
      label: t("orbitTagNoAccount"),
    },
  ]

  return (
    <CommunityOrbit
      items={items}
      stats={stats}
      headline={t.rich("orbitHeadline", {
        br: () => <br className="hidden sm:block" />,
      })}
      tags={tags}
    />
  )
}

function buildItems(
  shops: DirectoryShop[],
  copy: { open: string; browse: string; local: string },
): OrbitItem[] {
  const ranked = [...shops].sort((a, b) => {
    const aLogo = a.logo?.thumbnail ?? a.logo?.original ? 1 : 0
    const bLogo = b.logo?.thumbnail ?? b.logo?.original ? 1 : 0
    return bLogo - aLogo
  })

  const avatars: OrbitItem[] = OUTER_ANGLES.map((angle, index) => {
    const shop = ranked[index]
    const color = AVATAR_COLORS[index % AVATAR_COLORS.length]!
    if (!shop) {
      return {
        kind: "avatar",
        ring: "outer",
        angle,
        color,
        initial: "Z",
        size: index % 2 === 0 ? 72 : 64,
      }
    }
    return {
      kind: "avatar",
      ring: "outer",
      angle,
      src: shop.logo?.thumbnail ?? shop.logo?.original ?? null,
      alt: shop.name,
      color,
      initial: initialOf(shop.name),
      size: index % 2 === 0 ? 72 : 64,
    }
  })

  const inner: OrbitItem[] = [
    {
      kind: "pill",
      ring: "inner",
      angle: INNER_ANGLES[0]!,
      icon: <Store className="size-3.5" strokeWidth={2.2} />,
      label: copy.browse,
    },
    {
      kind: "status",
      ring: "inner",
      angle: INNER_ANGLES[1]!,
      label: copy.open,
    },
    {
      kind: "card",
      ring: "inner",
      angle: INNER_ANGLES[2]!,
      emoji: "🛍️",
      badge: shops.length > 0 ? Math.min(shops.length, 99) : 3,
    },
    {
      kind: "pill",
      ring: "inner",
      angle: INNER_ANGLES[3]!,
      icon: <ShoppingBag className="size-3.5" strokeWidth={2.2} />,
      label: copy.local,
    },
  ]

  // One check mark tucked on the outer ring between the last avatars.
  const check: OrbitItem = {
    kind: "check",
    ring: "outer",
    angle: 95,
  }

  return [...avatars, check, ...inner]
}

function formatCount(n: number): string {
  if (n >= 1000) {
    const thousands = n / 1000
    const rounded =
      thousands >= 10
        ? Math.round(thousands).toString()
        : thousands.toFixed(thousands % 1 === 0 ? 0 : 1)
    return `${rounded}k+`
  }
  return n >= 10 ? `${n}+` : String(n)
}

function initialOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  return Array.from(trimmed)[0]!.toLocaleUpperCase()
}
