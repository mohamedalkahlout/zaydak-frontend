import { Archivo, DM_Mono, Newsreader } from "next/font/google"

/** Loaded in the app. The template only receives the variable class names. */
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  axes: ["wdth"],
  variable: "--pn-archivo",
})

const news = Newsreader({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  style: ["normal", "italic"],
  variable: "--pn-news",
})

const mono = DM_Mono({
  weight: "500",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--pn-mono",
})

export const PERSONNE_FONTS = `${archivo.variable} ${news.variable} ${mono.variable}`
