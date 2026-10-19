import { Fragment, type ReactNode } from "react"
import { highlight } from "./highlight"

/**
 * The small slice of markdown an assistant reply is allowed to carry.
 *
 * The bubble used to render `whitespace-pre-wrap` text and nothing else, on the
 * contract that the system prompt forbids markdown. The prompt does forbid it;
 * the models the platform actually falls back to emit `**bold**` and `1.` lists
 * anyway, and the vendor read the asterisks. Fighting that with more prompt
 * tokens loses to any model's instruction tuning, so the renderer meets it
 * halfway: bold, inline code and simple lists become real markup, headings and
 * table pipes are stripped to their text, and everything else stays literal.
 *
 * Three properties this deliberately keeps:
 *
 * - **No dependency and no HTML.** Every leaf goes through React as a string,
 *   so a reply is text no matter what the model emits — there is no parser to
 *   trick and no `dangerouslySetInnerHTML` to sanitize.
 * - **Plain text is untouched.** Anything that is not a list line is emitted
 *   verbatim with its newlines, and the caller keeps `whitespace-pre-wrap`, so
 *   an ordinary reply renders exactly as it did before this file existed.
 * - **The find bar still works.** Leaves run through `highlight()`, so a match
 *   inside a bold run or a list item is still marked.
 *
 * Deliberately NOT supported: links (an assistant-authored href is a phishing
 * surface), images, blockquotes, and fenced code blocks — the fence markers are
 * dropped and their contents stay plain.
 */

/** `**bold**` and `` `code` ``, kept as capture groups so `split` returns them. */
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g

const UNORDERED = /^\s{0,3}[-*•]\s+(.*)$/
const ORDERED = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/
const FENCE = /^\s{0,3}(```|~~~)/
/** A `|---|:--:|` rule under a table header — noise with no text in it. */
const TABLE_RULE = /^\s*\|?[\s|:-]+\|?\s*$/
const TABLE_ROW = /^\s*\|(.+)\|\s*$/

interface ListRun {
  ordered: boolean
  start: number
  items: string[]
}

/** Split one line into bold / code / plain runs, each highlighted. */
function inline(line: string, query: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  // `split` on a regex with one capture group interleaves delimiters with the
  // text between them, so a single pass yields every run in order.
  line.split(INLINE).forEach((run, i) => {
    if (!run) return
    const k = `${key}:${i}`
    if (run.length > 4 && run.startsWith("**") && run.endsWith("**")) {
      out.push(
        <strong key={k} className="font-semibold">
          {highlight(run.slice(2, -2), query)}
        </strong>,
      )
    } else if (run.length > 2 && run.startsWith("`") && run.endsWith("`")) {
      out.push(
        <code
          key={k}
          className="rounded bg-foreground/8 px-1 py-0.5 font-mono text-[0.9em]"
        >
          {highlight(run.slice(1, -1), query)}
        </code>,
      )
    } else {
      out.push(<Fragment key={k}>{highlight(run, query)}</Fragment>)
    }
  })
  return out
}

/**
 * Reduce a line to the text a reader wants from it: strip a heading's hashes,
 * turn a table row into a `·`-separated line, drop a fence marker. Returns
 * `null` for a line that carries nothing (a table rule).
 */
function plainify(line: string): string | null {
  const heading = line.match(HEADING)
  if (heading) return heading[1]
  if (FENCE.test(line)) return null
  const row = line.match(TABLE_ROW)
  if (row) {
    if (TABLE_RULE.test(line)) return null
    const cells = row[1]
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
    return cells.length ? cells.join(" · ") : null
  }
  return line
}

export function renderLightMarkdown(
  text: string,
  highlightQuery = "",
): ReactNode {
  const source = text.split("\n")
  const out: ReactNode[] = []

  // Plain lines accumulate verbatim (newlines and all) and are flushed as one
  // node whenever a list interrupts them, so `whitespace-pre-wrap` on the
  // caller still decides the spacing of ordinary prose.
  let textRun: string[] = []
  let list: ListRun | null = null

  const flushText = (trimTrailingBlanks: boolean) => {
    const lines = textRun
    textRun = []
    if (trimTrailingBlanks) {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    }
    if (!lines.length) return
    const key = `t${out.length}`
    out.push(
      <Fragment key={key}>
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && "\n"}
            {inline(line, highlightQuery, `${key}:${i}`)}
          </Fragment>
        ))}
      </Fragment>,
    )
  }

  const flushList = () => {
    if (!list) return
    const { ordered, start, items } = list
    list = null
    const key = `l${out.length}`
    // `whitespace-normal` because the list markup, not the source's leading
    // spaces, is what indents these now. Logical padding keeps RTL right.
    const body = items.map((item, i) => (
      <li key={i} className="whitespace-normal">
        {inline(item, highlightQuery, `${key}:${i}`)}
      </li>
    ))
    out.push(
      ordered ? (
        <ol key={key} start={start} className="my-1 list-decimal space-y-0.5 ps-5">
          {body}
        </ol>
      ) : (
        <ul key={key} className="my-1 list-disc space-y-0.5 ps-5">
          {body}
        </ul>
      ),
    )
  }

  for (const raw of source) {
    const unordered = raw.match(UNORDERED)
    const ordered = unordered ? null : raw.match(ORDERED)

    if (unordered || ordered) {
      const item = unordered ? unordered[1] : ordered![2]
      const isOrdered = !unordered
      // A change of list kind closes the run; a bare number keeps its own
      // numbering so "4." after "1." does not silently renumber to 2.
      if (list && list.ordered !== isOrdered) flushList()
      if (!list) {
        flushText(true)
        list = {
          ordered: isOrdered,
          start: isOrdered ? Number(ordered![1]) : 1,
          items: [],
        }
      }
      list.items.push(item)
      continue
    }

    // A blank line inside a list ends it; anything else does too.
    if (list) flushList()
    const line = plainify(raw)
    if (line !== null) textRun.push(line)
  }

  flushList()
  flushText(false)

  return out.length === 1 ? out[0] : <>{out}</>
}
