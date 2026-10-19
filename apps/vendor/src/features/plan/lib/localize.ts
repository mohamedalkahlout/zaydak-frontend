import type { Translate } from "@/shared/i18n/translator"

/**
 * Arabic when the locale asks for it and the row actually has it, English
 * otherwise.
 *
 * The fallback is the point: plan and capability names are seeded per
 * deployment, and a tier whose Arabic name was never filled in should read as
 * its English name rather than as a blank cell in the pricing table.
 */
export function pickLocale(
  en: string,
  ar: string | null | undefined,
  locale: string,
): string {
  return (locale.startsWith("ar") && ar) || en
}

/** The capability groups the registry ships, each named under `plan.groups`. */
const GROUP_KEYS = new Set([
  "ai_agent",
  "ai_catalog",
  "ai_images",
  "ai_search",
  "ai_text",
  "ai_vision",
  "core",
  "marketing",
])

/**
 * A capability group's heading, from the `plan` translator. Groups carry no
 * name of their own on the server — only a slug — so a known one is named in
 * the catalogue, and one added after this build reads as its slug with the
 * separators spaced out (`ai_studio` → "ai studio") rather than as a key.
 */
export function groupLabel(group: string, t: Translate): string {
  if (GROUP_KEYS.has(group)) return t(`groups.${group}`)
  return group.replace(/[_-]+/g, " ")
}
