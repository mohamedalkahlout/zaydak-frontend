import { DM_Mono, Figtree, Shantell_Sans } from "next/font/google"

/** Loaded in the app. The template only receives the variable class names. */
const hand = Shantell_Sans({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  axes: ["BNCE", "INFM"],
  variable: "--hullo-hand",
})

const ui = Figtree({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--hullo-ui",
})

const mono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--hullo-mono",
})

export const HULLO_FONTS = `${hand.variable} ${ui.variable} ${mono.variable}`
