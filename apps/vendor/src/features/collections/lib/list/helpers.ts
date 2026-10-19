import type { TranslatedText } from "@/shared/types/api"

/** Normalize a TranslatedText to a display string. */
export function collectionName(
  value: TranslatedText | null | undefined,
): string {
  if (!value) return ""
  return value.en ?? value.ar ?? ""
}
