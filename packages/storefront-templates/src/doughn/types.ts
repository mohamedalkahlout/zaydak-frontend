/**
 * The content contract of the doughn template.
 *
 * Everything a shop would change lives here and is plain data — no functions, no
 * markup — so a later version can load it per merchant instead of importing the
 * sample bakery from `content.ts`. Copy strings fill `{placeholders}` through
 * `lib/fill.tsx`.
 *
 * A merchant can replace the photos the street actually draws: the night plate,
 * the daylight plate, the window frame, both doors, the shutter, the interior,
 * and each basket cut-out. An absent URL keeps the bundled file. Positions stay
 * measured in `scene/geometry.ts`. Light spill, steam, and the closing-shutter
 * textures are effects, not shop photos.
 */

export type Lang = "en" | "ar"

/** The breads the art has a cut-out for. Each one sits in a basket on the rack. */
export type BreadId =
  | "tamees"
  | "kaak"
  | "samoon"
  | "zaatar"
  | "sourdough"
  | "croissant"
  | "date"
  | "cardamom"

export interface DoughnItem {
  id: BreadId
  /** Batch times in minutes after midnight, shop time. The first is the one the card leads with. */
  times: number[]
  /** Whole units of the shop's currency. */
  price: number
  name: Record<Lang, string>
  note: Record<Lang, string>
  /** Replaces the bundled cut-out when the merchant uploaded one, or a product photo. */
  image?: string
  /** Product page. Absent on the sample, which stays inside the template. */
  href?: string
}

export interface DoughnCopy {
  loader: string
  menu: string
  /** the language pill: the other language, named in itself */
  switchTo: string
  bagAria: string
  menuAria: string
  bagTitle: string
  streetAria: string
  h1: string
  heroSub: string
  ctaBoard: string
  ctaReserve: string
  cue: string
  /** The painted lines on the shutter, one per row. */
  paint: string[]
  paintSmall: string
  boardEyebrow: string
  boardH: string
  nowIn: string
  peeking: string
  peek: string
  peekReset: string
  boardFoot: string
  visitEyebrow: string
  whereT: string
  whereD: string
  hoursT: string
  hoursD: string
  knowT: string
  knowD: string
  directions: string
  closing: string
  closingSmall: string
  openAgain: string
  demo: string
  linkStreet: string
  linkBoard: string
  linkVisit: string
  rollNote: string
  close: string
  bagH: string
  bagEmpty: string
  slotL: string
  nameL: string
  total: string
  reserve: string
  bagNote: string
  ticketH: string
  done: string
  /** `{slot}`, `{name}` */
  ticketLine: string
  open: string
  shut: string
  /** `{left}`: time until closing */
  openLine: string
  /** `{wait}`: time until opening */
  shutLine: string
  chip: {
    warm: string
    oven: string
    fresh: string
    /** `{at}` */
    later: string
    /** `{at}` */
    tomorrow: string
  }
  /** `{list}`: the later batch times */
  again: string
  add: string
  added: string
  currency: string
  am: string
  city: string
  /** Captions along the street: [story minute, line]. The minutes must match across languages. */
  caps: [number, string][]
}

/** Shop photos drawn on the street. Each absent field keeps its bundled file. */
export interface DoughnSceneImages {
  /** Night storefront plate. */
  hero?: string
  /** Daylight storefront plate, crossfaded over the night plate. */
  daylight?: string
  /** Window frame over the opening. */
  frame?: string
  /** Door at night. */
  door?: string
  /** Door in daylight, crossfaded over the night door. */
  doorDay?: string
  /** Rolling shutter. The slats share this one picture. */
  shutter?: string
  /** Interior behind the glass. */
  interior?: string
}

export interface DoughnContent {
  images?: DoughnSceneImages
  /** The shop's name: the lit sign, the nav wordmark and the closing shutter. */
  brand: string
  /** IANA time zone the bake times and opening hours are in. */
  timeZone: string
  /** Minutes after midnight. */
  hours: { open: number; close: number }
  mapUrl: string
  /** Pickup times offered in the bag, as shown. */
  slots: string[]
  /** Exactly eight, in basket order: top row left to right, then the bottom row. */
  items: DoughnItem[]
  copy: Record<Lang, DoughnCopy>
  defaultLang: Lang
}
