import {
  Bagel_Fat_One,
  Bricolage_Grotesque,
  IBM_Plex_Sans_Arabic,
  Lalezar,
} from "next/font/google"

/**
 * The drip faces, loaded by this app. `next/font` has to run inside the app
 * that compiles the page; the template itself only receives the class names.
 * The variables match the vendor preview (`--drip-*`).
 */
const bagel = Bagel_Fat_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--drip-bagel",
})

const body = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--drip-body",
})

const plex = IBM_Plex_Sans_Arabic({
  weight: ["400", "500", "700"],
  subsets: ["arabic", "latin"],
  variable: "--drip-plex",
})

const lalezar = Lalezar({
  weight: "400",
  subsets: ["arabic", "latin"],
  variable: "--drip-lalezar",
})

export const DRIP_FONTS = `${bagel.variable} ${body.variable} ${plex.variable} ${lalezar.variable}`
