import { Bagel_Fat_One, Bricolage_Grotesque, IBM_Plex_Sans_Arabic, Lalezar } from "next/font/google"

/** Loaded in the app. The template only receives the variable class names. */
const bagel = Bagel_Fat_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--drip-bagel",
})

const body = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  axes: ["opsz"],
  variable: "--drip-body",
})

const plex = IBM_Plex_Sans_Arabic({
  weight: ["400", "500", "700"],
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--drip-plex",
})

const lalezar = Lalezar({
  weight: "400",
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--drip-lalezar",
})

export const DRIP_FONTS = `${bagel.variable} ${body.variable} ${plex.variable} ${lalezar.variable}`
