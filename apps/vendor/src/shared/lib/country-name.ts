/**
 * A country's name in `locale`, from the runtime's CLDR data
 * (`Intl.DisplayNames`) rather than a message per country — or null when the
 * runtime does not know the code, so each caller keeps its own fallback.
 *
 * CLDR's long name for PS is "Palestinian Territories" / "الأراضي الفلسطينية";
 * the dashboard's country lists have always said "Palestine" / "فلسطين", which
 * is CLDR's short form. The short form is not used for the rest, where it
 * abbreviates ("US", "UK"). The customer form and the coupon and shipping-zone
 * pickers all read this, so they cannot name the same country two ways.
 */
const SHORT_NAME_REGIONS = new Set(["PS"])

const DISPLAY_NAMES = new Map<string, Intl.DisplayNames | null>()

function displayNames(
  locale: string,
  style: "long" | "short",
): Intl.DisplayNames | null {
  const key = `${locale}:${style}`
  if (!DISPLAY_NAMES.has(key)) {
    let names: Intl.DisplayNames | null = null
    try {
      names = new Intl.DisplayNames([locale], {
        type: "region",
        style,
        fallback: "none",
      })
    } catch {
      names = null
    }
    DISPLAY_NAMES.set(key, names)
  }
  return DISPLAY_NAMES.get(key) ?? null
}

export function regionName(code: string, locale: string): string | null {
  const normalized = code.trim().toUpperCase()
  try {
    const style = SHORT_NAME_REGIONS.has(normalized) ? "short" : "long"
    return displayNames(locale, style)?.of(normalized) ?? null
  } catch {
    // `of` throws on anything that is not a region code — a free-text country.
    return null
  }
}
