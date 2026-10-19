import type { CSSProperties } from "react"

import bag from "./art/l-bag.webp"
import hand from "./art/l-hand.webp"
import pour from "./art/l-pour.webp"
import windowShot from "./art/l-window.webp"
import americano from "./art/p-americano.webp"
import cardamom from "./art/p-cardamom.webp"
import cherry from "./art/p-cherry.webp"
import croissant from "./art/p-croissant.webp"
import latte from "./art/p-latte.webp"
import matcha from "./art/p-matcha.webp"
import spanish from "./art/p-spanish.webp"
import ube from "./art/p-ube.webp"
import interior from "./art/interior.webp"
import storefront from "./art/storefront.webp"

/**
 * Sample shop for the hullo template: a walk-up coffee window in Riyadh.
 * The words and the photos come from the Genesis Works demo. See the feature
 * doc before any merchant goes live with this template.
 */
export interface HulloItem {
  id: string
  name: string
  blurb: string
  price: number
  tags: string
  bg: string
  alt: string
  image: { src: string; width: number; height: number }
  rotate: string
  dy: string
  /** False when the shop cannot sell this row. The sample menu omits it. */
  inStock?: boolean
}

export const HULLO_ART = {
  storefront,
  interior,
} as const

export const HULLO_MENU: HulloItem[] = [
  {
    id: "americano",
    name: "iced americano",
    blurb: "cold, dark, zero drama.",
    price: 14,
    tags: "iced coffee",
    bg: "#BCD7EA",
    alt: "Iced americano in a clear cup",
    image: americano,
    rotate: "-2.5deg",
    dy: "0px",
  },
  {
    id: "latte",
    name: "oat latte",
    blurb: "the default setting. rosetta on top.",
    price: 17,
    tags: "hot coffee",
    bg: "#F3DC8C",
    alt: "Hot oat latte with a rosetta",
    image: latte,
    rotate: "1.8deg",
    dy: "34px",
  },
  {
    id: "matcha",
    name: "iced matcha",
    blurb: "grassy, creamy, a little extra.",
    price: 19,
    tags: "iced nocoffee",
    bg: "#AEBB9C",
    alt: "Iced matcha latte in a glass",
    image: matcha,
    rotate: "-1.2deg",
    dy: "8px",
  },
  {
    id: "spanish",
    name: "iced spanish latte",
    blurb: "condensed milk at the bottom. stir or don't.",
    price: 19,
    tags: "iced coffee",
    bg: "#E9C2A0",
    alt: "Iced Spanish latte with condensed milk at the bottom",
    image: spanish,
    rotate: "2.6deg",
    dy: "46px",
  },
  {
    id: "cherry",
    name: "cherry cold brew",
    blurb: "pink cherry foam, one real cherry.",
    price: 21,
    tags: "iced coffee",
    bg: "#F2B8B5",
    alt: "Cherry cold brew with pink cold foam and a cherry",
    image: cherry,
    rotate: "1.4deg",
    dy: "-10px",
  },
  {
    id: "ube",
    name: "ube latte",
    blurb: "purple yam and oat. yes, it's that purple.",
    price: 20,
    tags: "iced nocoffee",
    bg: "#CDBDE6",
    alt: "Iced ube latte, purple over milk",
    image: ube,
    rotate: "-2.2deg",
    dy: "26px",
  },
  {
    id: "croissant",
    name: "pistachio croissant",
    blurb: "loud crunch, filled end to end.",
    price: 16,
    tags: "bakes",
    bg: "#E8DCC8",
    alt: "Croissant filled with pistachio cream",
    image: croissant,
    rotate: "2.1deg",
    dy: "-2px",
  },
  {
    id: "cardamom",
    name: "cardamom knot",
    blurb: "hel, butter, pearl sugar. warm before 10.",
    price: 12,
    tags: "bakes",
    bg: "#5A3D30",
    alt: "Cardamom knot bun with pearl sugar",
    image: cardamom,
    rotate: "-1.6deg",
    dy: "30px",
  },
]

export const HULLO_STICKERS = ["americano", "cherry", "latte", "croissant"] as const

export const HULLO_FILTERS = [
  { id: "all", label: "all" },
  { id: "iced", label: "iced" },
  { id: "hot", label: "hot" },
  { id: "nocoffee", label: "no coffee" },
  { id: "bakes", label: "bakes" },
] as const

export const HULLO_MARQUEE = [
  "iced coffee in december",
  "oat milk costs nothing extra",
  "say hullo through the window",
  "pastries until they run out",
  "open till 11",
] as const

export const HULLO_SNAPS = [
  { src: hand, alt: "A hand holding an iced latte against a cream wall", caption: "hand model: a regular", r: "-6deg", x: "4%", y: "10%" },
  { src: pour, alt: "Steamed milk being poured into a cup to make latte art", caption: "the pour, mid wobble", r: "4deg", x: "27%", y: "2%" },
  { src: windowShot, alt: "The coffee window at golden hour with two iced coffees waiting on the ledge", caption: "the window around 5pm", r: "-3deg", x: "51%", y: "14%" },
  { src: bag, alt: "A paper bag spilling a croissant and a cardamom bun next to an iced coffee", caption: "one of each, obviously", r: "7deg", x: "74%", y: "4%" },
] as const

export const HULLO_VIBES = [
  { id: "awake", label: "barely awake" },
  { id: "locked", label: "locked in" },
  { id: "soft", label: "soft day" },
  { id: "main", label: "main character" },
  { id: "sunday", label: "sunday reset" },
] as const

export const HULLO_BASES = [
  { id: "espresso", label: "espresso" },
  { id: "coldbrew", label: "cold brew" },
  { id: "matcha", label: "matcha" },
  { id: "ube", label: "ube" },
] as const

export const HULLO_MILKS = [
  { id: "oat", label: "oat" },
  { id: "whole", label: "whole" },
  { id: "almond", label: "almond" },
  { id: "none", label: "none" },
] as const

export const HULLO_SWEETS = [
  { id: "none", label: "none" },
  { id: "vanilla", label: "vanilla" },
  { id: "caramel", label: "caramel" },
  { id: "cherry", label: "cherry" },
  { id: "condensed", label: "condensed milk" },
] as const

export const HULLO_ICES = [
  { id: "1", label: "light" },
  { id: "2", label: "normal" },
  { id: "3", label: "extra" },
] as const

export const HULLO_SIZES = [
  { id: "s", label: "small" },
  { id: "m", label: "regular" },
  { id: "l", label: "big" },
] as const

export function cardStyle(item: HulloItem): CSSProperties {
  return { "--bg": item.bg, "--r": item.rotate, "--dy": item.dy } as CSSProperties
}
