import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Reem_Kufi } from "next/font/google"

/** Loaded in the app. The template only receives the variable class names. */
const reem = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--jr-reem",
})

const plexAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--jr-plex-ar",
})

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--jr-plex",
})

export const JURAT_FONTS = `${reem.variable} ${plexAr.variable} ${plex.variable}`
