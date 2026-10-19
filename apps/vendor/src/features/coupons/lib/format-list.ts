const FORMATTERS = new Map<string, Intl.ListFormat | null>()

/**
 * Join display strings the way the active locale lists them side by side:
 * "3 products, 2 collections" in English, "3 منتجات ومجموعتان" in Arabic.
 *
 * `unit` rather than `conjunction`, because English has always read these as a
 * comma list with no "and" — the `unit` pattern keeps that exactly — while
 * Arabic gets its own separator (، and و) that a comma join would get wrong.
 */
export function formatList(items: readonly string[], locale: string): string {
  if (!FORMATTERS.has(locale)) {
    let formatter: Intl.ListFormat | null = null
    try {
      formatter = new Intl.ListFormat(locale, { type: "unit" })
    } catch {
      formatter = null
    }
    FORMATTERS.set(locale, formatter)
  }
  return FORMATTERS.get(locale)?.format(items) ?? items.join(", ")
}
