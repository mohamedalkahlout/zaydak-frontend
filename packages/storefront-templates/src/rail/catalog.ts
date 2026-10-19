import beforeBack from "./art/before-back.webp"
import beforeFront from "./art/before-front.webp"
import beforeSide from "./art/before-side.webp"
import beforeTurn from "./art/before-turn.webp"
import boroviBack from "./art/borovi-back.webp"
import boroviFront from "./art/borovi-front.webp"
import boroviSide from "./art/borovi-side.webp"
import boroviTurn from "./art/borovi-turn.webp"
import cupidFront from "./art/cupid-front.webp"
import cupidSide from "./art/cupid-side.webp"
import cupidTurn from "./art/cupid-turn.webp"
import dijamantBack from "./art/dijamant-back.webp"
import dijamantFront from "./art/dijamant-front.webp"
import dijamantSide from "./art/dijamant-side.webp"
import dijamantTurn from "./art/dijamant-turn.webp"
import fororaBack from "./art/forora-back.webp"
import fororaFront from "./art/forora-front.webp"
import fororaSide from "./art/forora-side.webp"
import fororaTurn from "./art/forora-turn.webp"
import grapesBack from "./art/grapes-back.webp"
import grapesFront from "./art/grapes-front.webp"
import grapesSide from "./art/grapes-side.webp"
import grapesTurn from "./art/grapes-turn.webp"
import growBack from "./art/grow-back.webp"
import growFront from "./art/grow-front.webp"
import growSide from "./art/grow-side.webp"
import growTurn from "./art/grow-turn.webp"
import mBirdBack from "./art/m-bird-back.webp"
import mBirdFront from "./art/m-bird-front.webp"
import mBirdSide from "./art/m-bird-side.webp"
import mBirdTurn from "./art/m-bird-turn.webp"
import n2067Front from "./art/n2067-front.webp"
import n2067Side from "./art/n2067-side.webp"
import n2067Turn from "./art/n2067-turn.webp"
import tagGreenBack from "./art/tag-green-back.webp"
import tagGreenFront from "./art/tag-green-front.webp"
import tagGreenSide from "./art/tag-green-side.webp"
import tagGreenTurn from "./art/tag-green-turn.webp"

/** Next returns `{ src }`; the test runner returns the URL string. */
export type RailImage = string | { src: string }

export function railImageSrc(image: RailImage): string {
  return typeof image === "string" ? image : image.src
}

export interface RailPiece {
  id: string
  name: string
  type: string
  colorName: string
  /** Edge-on cutout painted while the piece hangs in profile. */
  side: RailImage
  /** Front-facing cutout painted when the piece turns toward you. */
  front: RailImage
  /** Profile-to-front frames played after a mobile swipe settles. */
  turn: RailImage
  back?: RailImage
  /** Product page. The sample pieces have none. */
  href?: string
}

/** Cutouts from the Molimao rail demo, drawn onto a 560×530 canvas. */
export const RAIL_PIECES: RailPiece[] = [
  {
    id: "before",
    name: "Before",
    type: "Men's T-shirt",
    colorName: "White",
    side: beforeSide,
    front: beforeFront,
    turn: beforeTurn,
    back: beforeBack,
  },
  {
    id: "forora",
    name: "FORORA — REIGN",
    type: "Football jersey",
    colorName: "Black",
    side: fororaSide,
    front: fororaFront,
    turn: fororaTurn,
    back: fororaBack,
  },
  {
    id: "grow",
    name: "Grow",
    type: "Women's oversize T-shirt",
    colorName: "Ivory",
    side: growSide,
    front: growFront,
    turn: growTurn,
    back: growBack,
  },
  {
    id: "2067",
    name: "2067",
    type: "Women's crewneck",
    colorName: "Ivory",
    side: n2067Side,
    front: n2067Front,
    turn: n2067Turn,
  },
  {
    id: "tag-green",
    name: "Tag Green",
    type: "Men's hoodie",
    colorName: "Emerald",
    side: tagGreenSide,
    front: tagGreenFront,
    turn: tagGreenTurn,
    back: tagGreenBack,
  },
  {
    id: "borovi",
    name: "Borovi",
    type: "Men's hoodie",
    colorName: "Charcoal",
    side: boroviSide,
    front: boroviFront,
    turn: boroviTurn,
    back: boroviBack,
  },
  {
    id: "grapes",
    name: "Grapes",
    type: "Men's crewneck",
    colorName: "Ivory",
    side: grapesSide,
    front: grapesFront,
    turn: grapesTurn,
    back: grapesBack,
  },
  {
    id: "cupid",
    name: "Cupid",
    type: "Women's oversize T-shirt",
    colorName: "Violet",
    side: cupidSide,
    front: cupidFront,
    turn: cupidTurn,
  },
  {
    id: "dijamant",
    name: "Dijamant",
    type: "Women's oversize T-shirt",
    colorName: "Violet",
    side: dijamantSide,
    front: dijamantFront,
    turn: dijamantTurn,
    back: dijamantBack,
  },
  {
    id: "m-bird",
    name: "M Bird",
    type: "Men's oversize T-shirt",
    colorName: "Violet",
    side: mBirdSide,
    front: mBirdFront,
    turn: mBirdTurn,
    back: mBirdBack,
  },
]
