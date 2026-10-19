/**
 * Turning a colour *option value* into a swatch.
 *
 * The API gives the picker labels and nothing else — `option_definitions`
 * carries `values { label }`, with no hex, no swatch image and no type flag.
 * So a swatch is a rendering the storefront infers, and it has to fail closed:
 * a circle in the wrong colour is worse than a chip with the right word in it,
 * because the shopper believes the circle.
 *
 * Hence two rules:
 *
 *  - `swatchColor` resolves only names it actually knows, in both locales, and
 *    returns null for anything else.
 *  - `isColorOption` requires the option to be *named* a colour **and** every
 *    one of its values to resolve. One unknown value and the whole option falls
 *    back to text chips, so a picker is never half circles and half words.
 */

/** `#rrggbb` for the names shops actually type, en + ar. */
const SWATCHES: Record<string, string> = {
  black: "#111111",
  white: "#ffffff",
  ivory: "#fffff0",
  cream: "#f5efe0",
  beige: "#e8dcc8",
  sand: "#dccaa8",
  khaki: "#c3b091",
  tan: "#d2b48c",
  brown: "#7b4a2d",
  chocolate: "#4a2c1a",
  grey: "#9a9a9a",
  gray: "#9a9a9a",
  silver: "#c9c9c9",
  charcoal: "#3a3a3a",
  navy: "#1f2a54",
  blue: "#2563a8",
  "light blue": "#8fbcdb",
  "sky blue": "#87ceeb",
  teal: "#1f7a75",
  turquoise: "#40c4bb",
  mint: "#b7e4c7",
  green: "#2f7a4f",
  olive: "#6b7a3a",
  sage: "#a8b99a",
  lime: "#a8d84a",
  yellow: "#e8c13a",
  mustard: "#d4a017",
  gold: "#c9a227",
  orange: "#e2762e",
  peach: "#f5c2a0",
  coral: "#f08a72",
  red: "#c02b1f",
  burgundy: "#6d2333",
  maroon: "#6d2333",
  pink: "#e8a0b8",
  "hot pink": "#e0559a",
  fuchsia: "#c1449b",
  purple: "#6f3f9e",
  lavender: "#c4b3e0",
  violet: "#7a4bbf",
  indigo: "#3f3d8f",
  rose: "#d98a94",
  "rose gold": "#dda898",
  bronze: "#a97142",
  copper: "#b46a3f",
  multicolor: "#cccccc",
  transparent: "#f2ede6",

  // Arabic — the same list as vendors write it.
  أسود: "#111111",
  ابيض: "#ffffff",
  أبيض: "#ffffff",
  عاجي: "#fffff0",
  بيج: "#e8dcc8",
  بني: "#7b4a2d",
  رمادي: "#9a9a9a",
  فضي: "#c9c9c9",
  كحلي: "#1f2a54",
  أزرق: "#2563a8",
  ازرق: "#2563a8",
  تركوازي: "#40c4bb",
  أخضر: "#2f7a4f",
  اخضر: "#2f7a4f",
  زيتوني: "#6b7a3a",
  أصفر: "#e8c13a",
  اصفر: "#e8c13a",
  ذهبي: "#c9a227",
  برتقالي: "#e2762e",
  أحمر: "#c02b1f",
  احمر: "#c02b1f",
  خمري: "#6d2333",
  وردي: "#e8a0b8",
  زهري: "#e8a0b8",
  بنفسجي: "#6f3f9e",
  نيلي: "#3f3d8f",
  شفاف: "#f2ede6",
}

/** Option names that mean "colour", in both locales. */
const COLOR_OPTION_NAMES = new Set([
  "color",
  "colour",
  "colors",
  "colours",
  "لون",
  "اللون",
  "الألوان",
  "الالوان",
])

/** The hex for a value label, or null when the name is not one we know. */
export function swatchColor(label: string): string | null {
  return SWATCHES[label.trim().toLowerCase()] ?? null
}

/** Whether an option should render as circles rather than chips. */
export function isColorOption(
  optionName: string,
  values: readonly string[],
): boolean {
  if (!COLOR_OPTION_NAMES.has(optionName.trim().toLowerCase())) return false
  return values.length > 0 && values.every((value) => swatchColor(value) !== null)
}

/**
 * Whether a swatch needs a visible edge of its own.
 *
 * White and near-white circles vanish into the card they sit on, and the
 * selected-state ring is drawn outside the circle so it cannot stand in for
 * one. Threshold is on perceived luminance rather than on the literal string
 * "white", so ivory and cream get the same treatment.
 */
export function swatchNeedsBorder(hex: string): boolean {
  const value = hex.replace("#", "")
  if (value.length !== 6) return false
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return false
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.85
}
