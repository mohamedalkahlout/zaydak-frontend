import type { BreadId } from "./types"

import doorNight from "./art/door-night.webp"
import doorSun from "./art/door-sun.webp"
import interior from "./art/interior.webp"
import openNight from "./art/open-night.webp"
import pCardamom from "./art/p-cardamom.webp"
import pCroissant from "./art/p-croissant.webp"
import pDate from "./art/p-date.webp"
import pKaak from "./art/p-kaak.webp"
import pSamoon from "./art/p-samoon.webp"
import pSourdough from "./art/p-sourdough.webp"
import pTamees from "./art/p-tamees.webp"
import pZaatar from "./art/p-zaatar.webp"
import plateNight from "./art/plate-night.webp"
import plateSun from "./art/plate-sun.webp"
import shutter from "./art/shutter.webp"
import spill from "./art/spill.webp"
import steam from "./art/steam.webp"

/**
 * The art, bundled with the template so the folder moves as one piece. Images that
 * only CSS uses (shutter slats, drum, grain) are referenced from the stylesheets.
 *
 * The street plates, interior, door, shutter and bread cut-outs come from the
 * Genesis Works "doughn" demo; see the feature doc before any merchant goes live.
 */
export const ART = {
  plateNight: plateNight.src,
  plateSun: plateSun.src,
  openNight: openNight.src,
  doorNight: doorNight.src,
  doorSun: doorSun.src,
  spill: spill.src,
  shutter: shutter.src,
  interior: interior.src,
  steam: steam.src,
} as const

export const BREAD_ART: Record<BreadId, string> = {
  tamees: pTamees.src,
  kaak: pKaak.src,
  samoon: pSamoon.src,
  zaatar: pZaatar.src,
  sourdough: pSourdough.src,
  croissant: pCroissant.src,
  date: pDate.src,
  cardamom: pCardamom.src,
}

/** What the alarm waits for before the street opens: everything on screen in the first frames. */
export const FIRST_FRAME_ART = [ART.plateNight, ART.openNight, ART.doorNight, ART.shutter, ART.interior, ART.plateSun, ART.spill]

/** Same first frames, with a merchant photo in place of the bundled file when one is set. */
export function openingArt(images?: {
  hero?: string
  frame?: string
  door?: string
  shutter?: string
  interior?: string
  daylight?: string
}): string[] {
  const custom = [
    images?.hero,
    images?.frame,
    images?.door,
    images?.shutter,
    images?.interior,
    images?.daylight,
  ]
  return FIRST_FRAME_ART.map((bundled, index) => custom[index] || bundled)
}
