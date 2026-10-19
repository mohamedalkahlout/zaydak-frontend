import { Fragment } from "react"

/**
 * Splits `text` around every occurrence of `query` (case-insensitive)
 * and wraps the matches in a yellow `<mark>`-like span. Returns a
 * fragment ready to drop into any JSX.
 *
 * Implemented as a simple indexOf walk instead of regex so the query
 * never has to be escaped — a vendor typing `?` or `(` in the sidebar
 * search shouldn't throw a regex parse error.
 *
 * Non-matching text passes through untouched. When `query` is empty,
 * returns the original string unchanged so the caller can always
 * render via this helper without branching.
 */
export function highlight(text: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return text

  const haystack = text
  const needle = trimmed.toLowerCase()
  const lower = haystack.toLowerCase()

  const parts: Array<{ text: string; match: boolean }> = []
  let cursor = 0
  while (cursor < haystack.length) {
    const hit = lower.indexOf(needle, cursor)
    if (hit === -1) {
      parts.push({ text: haystack.slice(cursor), match: false })
      break
    }
    if (hit > cursor) {
      parts.push({ text: haystack.slice(cursor, hit), match: false })
    }
    parts.push({
      text: haystack.slice(hit, hit + needle.length),
      match: true,
    })
    cursor = hit + needle.length
  }

  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p.match ? (
            <mark className="bg-amber-200 text-amber-900 rounded-sm px-0.5">
              {p.text}
            </mark>
          ) : (
            p.text
          )}
        </Fragment>
      ))}
    </>
  )
}
