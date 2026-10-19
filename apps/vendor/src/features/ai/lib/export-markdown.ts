import type { Translate } from "@/shared/i18n/translator"
import type { VendorAgentMessage, VendorAgentToolEvent } from "./types"
import { isResumeTurn } from "./resume-marker"

/**
 * Serialize a vendor-agent conversation to markdown.
 *
 * Shape:
 *  - Front-matter-ish header with title + export timestamp.
 *  - Each message becomes a section with a role heading.
 *  - Tool events are embedded as fenced JSON code blocks so the output
 *    is self-describing — the reader sees both the chat and what the
 *    agent actually did under the hood.
 *  - Attached-image markers `[Attached images: ...]` are preserved
 *    verbatim; they point at CDN URLs and stay usable.
 *
 * The headings are in the vendor's language: `t` is a translator scoped to
 * `aiChat.export`.
 */
export function conversationToMarkdown(args: {
  title: string | null
  messages: VendorAgentMessage[]
  t: Translate
}): string {
  const { t } = args
  const lines: string[] = []

  lines.push(`# ${args.title ?? t("defaultTitle")}`)
  lines.push("")
  lines.push(`_${t("exported", { date: new Date().toISOString() })}_`)
  lines.push("")
  lines.push("---")
  lines.push("")

  for (const m of args.messages) {
    // Auto-resume turns are UI-internal — the vendor never typed them and
    // they don't render, so they don't belong in an export either.
    if (m.role === "user" && isResumeTurn(m.content)) continue
    const roleLabel =
      m.role === "user" ? `👤 ${t("user")}` : `🤖 ${t("assistant")}`
    lines.push(`## ${roleLabel}`)
    if (m.created_at) {
      lines.push(`_${new Date(m.created_at).toLocaleString()}_`)
    }
    lines.push("")

    if (m.content) {
      lines.push(m.content)
      lines.push("")
    }

    if (m.tool_events?.length) {
      lines.push(`### ${t("toolCalls")}`)
      for (const evt of m.tool_events) {
        lines.push(`- **${evt.name}** — ${evt.ok ? t("ok") : t("failed")}`)
        lines.push(renderToolDetail(evt))
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}

function renderToolDetail(evt: VendorAgentToolEvent): string {
  const payload: Record<string, unknown> = { args: evt.args }
  if (evt.ok) payload.result = evt.result
  else payload.error = evt.error
  return "```json\n" + JSON.stringify(payload, null, 2) + "\n```"
}

/**
 * Trigger a browser download of the given markdown content.
 * No dependencies — just a Blob + anchor trick.
 */
export function downloadMarkdown(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Give Safari a tick before revoking — some builds drop the download
  // if the URL is revoked synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
