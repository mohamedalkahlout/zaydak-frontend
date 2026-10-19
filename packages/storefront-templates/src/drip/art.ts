/* Bundled stills. The behaviour builds scoops and crowns by filename. */
import cone from "./art/cone.webp"
import cup from "./art/cup.webp"
import cupLg from "./art/cup-lg.webp"
import scoopPistachio from "./art/scoop-pistachio.webp"
import scoopPistachioT from "./art/scoop-pistachio-t.webp"
import scoopPistachioM from "./art/scoop-pistachio-m.webp"
import scoopStracciatella from "./art/scoop-stracciatella.webp"
import scoopStracciatellaT from "./art/scoop-stracciatella-t.webp"
import scoopStracciatellaM from "./art/scoop-stracciatella-m.webp"
import scoopFondente from "./art/scoop-fondente.webp"
import scoopFondenteT from "./art/scoop-fondente-t.webp"
import scoopFondenteM from "./art/scoop-fondente-m.webp"
import scoopFragola from "./art/scoop-fragola.webp"
import scoopFragolaT from "./art/scoop-fragola-t.webp"
import scoopFragolaM from "./art/scoop-fragola-m.webp"
import scoopSaffron from "./art/scoop-saffron.webp"
import scoopSaffronT from "./art/scoop-saffron-t.webp"
import scoopSaffronM from "./art/scoop-saffron-m.webp"
import scoopDate from "./art/scoop-date.webp"
import scoopDateT from "./art/scoop-date-t.webp"
import scoopDateM from "./art/scoop-date-m.webp"
import bitsPistachio from "./art/bits-pistachio.webp"
import bitsCocoa from "./art/bits-cocoa.webp"
import bitsRose from "./art/bits-rose.webp"
import milk from "./art/milk.webp"
import milkS from "./art/milk-s.webp"
import churn from "./art/churn.webp"
import churnS from "./art/churn-s.webp"
import casePhoto from "./art/case.webp"
import caseS from "./art/case-s.webp"
import shop from "./art/shop.webp"
import shopS from "./art/shop-s.webp"

const files: Record<string, { src: string }> = {
  "cone.webp": cone,
  "cup.webp": cup,
  "cup-lg.webp": cupLg,
  "scoop-pistachio.webp": scoopPistachio,
  "scoop-pistachio-t.webp": scoopPistachioT,
  "scoop-pistachio-m.webp": scoopPistachioM,
  "scoop-stracciatella.webp": scoopStracciatella,
  "scoop-stracciatella-t.webp": scoopStracciatellaT,
  "scoop-stracciatella-m.webp": scoopStracciatellaM,
  "scoop-fondente.webp": scoopFondente,
  "scoop-fondente-t.webp": scoopFondenteT,
  "scoop-fondente-m.webp": scoopFondenteM,
  "scoop-fragola.webp": scoopFragola,
  "scoop-fragola-t.webp": scoopFragolaT,
  "scoop-fragola-m.webp": scoopFragolaM,
  "scoop-saffron.webp": scoopSaffron,
  "scoop-saffron-t.webp": scoopSaffronT,
  "scoop-saffron-m.webp": scoopSaffronM,
  "scoop-date.webp": scoopDate,
  "scoop-date-t.webp": scoopDateT,
  "scoop-date-m.webp": scoopDateM,
  "bits-pistachio.webp": bitsPistachio,
  "bits-cocoa.webp": bitsCocoa,
  "bits-rose.webp": bitsRose,
  "milk.webp": milk,
  "milk-s.webp": milkS,
  "churn.webp": churn,
  "churn-s.webp": churnS,
  "case.webp": casePhoto,
  "case-s.webp": caseS,
  "shop.webp": shop,
  "shop-s.webp": shopS,
}

export function dripArt(file: string): string {
  const img = files[file]
  if (!img) throw new Error("drip art missing: " + file)
  return img.src
}
