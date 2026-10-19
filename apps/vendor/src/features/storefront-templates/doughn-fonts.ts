import type { CSSProperties } from "react"
import { Alexandria, Bagel_Fat_One, Doto, Hanken_Grotesk, Lalezar } from "next/font/google"

/**
 * Loaded here, not in `@repo/storefront-templates`. `next/font` has to run
 * inside the app that compiles the page; from the package Turbopack cannot
 * resolve its font module.
 *
 * The stacks use each face's own family, without next/font's Arial fallback.
 * Arial carries Arabic glyphs, so inside a Latin stack it would answer for
 * Arabic words before Alexandria.
 */
const bagel = Bagel_Fat_One({ weight: "400", subsets: ["latin"], display: "swap", adjustFontFallback: false })
const doto = Doto({ weight: "800", subsets: ["latin"], display: "swap", adjustFontFallback: false })
const hanken = Hanken_Grotesk({ subsets: ["latin"], display: "swap", adjustFontFallback: false })
const alexandria = Alexandria({ subsets: ["arabic", "latin"], display: "swap", preload: false, adjustFontFallback: false })
const lalezar = Lalezar({ weight: "400", subsets: ["arabic", "latin"], display: "swap", preload: false, adjustFontFallback: false })

const face = (font: { style: { fontFamily: string } }) => font.style.fontFamily.split(",")[0].trim()

export const DOUGHN_FONTS = {
  "--doughn-bagel": face(bagel),
  "--doughn-doto": face(doto),
  "--doughn-hanken": face(hanken),
  "--doughn-alexandria": face(alexandria),
  "--doughn-lalezar": face(lalezar),
} as CSSProperties
