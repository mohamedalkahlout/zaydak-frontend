"use client"

import type { Editor } from "@tiptap/react"

import type { Translate } from "@/shared/i18n/translator"
import { getApolloClient } from "@/shared/lib/auth/apollo-bridge"
import {
  AI_ACTION_ENUM,
  AI_TEXT_TRANSFORM,
  type AiAction,
  type AiTextData,
} from "@/shared/lib/ai-text"

export type { AiAction }

/** The menu's quick actions, in order. Each label is `editor.ai.actions.<id>`. */
export const AI_ACTIONS: Array<{
  id: Exclude<AiAction, "custom">
}> = [
  { id: "improve" },
  { id: "shorten" },
  { id: "extend" },
  { id: "simplify" },
  { id: "translate-en" },
  { id: "translate-ar" },
]

type EditorAiErrorKey = "startingUp" | "requestFailed"

/**
 * A failure raised here rather than by the API. It carries a key under
 * `editor.ai.errors` instead of copy: this module runs outside React and does
 * not know the dashboard's language, so the menu that catches it translates.
 */
export class EditorAiError extends Error {
  readonly key: EditorAiErrorKey

  constructor(key: EditorAiErrorKey) {
    super(`editor.ai.errors.${key}`)
    this.name = "EditorAiError"
    this.key = key
  }
}

/**
 * The failure toast's description: this module's own errors in the dashboard's
 * language, an error the API raised in its own words. `t` is
 * `useTranslations("editor.ai")`.
 */
export function aiErrorDescription(error: unknown, t: Translate): string {
  if (error instanceof EditorAiError) return t(`errors.${error.key}`)
  return error instanceof Error ? error.message : t("tryAgain")
}

/**
 * The editor's AI actions, on the API.
 *
 * **This used to POST to `/api/ai/editor`**, a Next.js route in this app that
 * called Groq directly with a `GROQ_API_KEY` from the frontend's own
 * environment. It worked and it sat outside every control the rest of the
 * platform's AI runs through: no session check, no plan quota, no per-user rate
 * limit, no platform budget, no output moderation, nothing written to
 * `usage_events` (so the spend never reached the admin's cost screen), and it
 * ignored the provider an admin picks at `/integrations/ai-chat` — switching
 * the platform to OpenRouter left the editor on Groq, silently.
 *
 * The mutation is billed per character against `ai.text.rewrite`,
 * `ai.text.summarize`, `ai.text.translate` or `ai.text.generate` depending on
 * the action. Those keys were priced in the plan matrix and read by no code
 * until this moved.
 *
 * Not in a feature's own `api.ts` because this is not a feature's operation —
 * it belongs to the shared editor, which any feature can mount.
 *
 * The mutation document and the action vocabulary moved to `ai-text.ts` when
 * the store-import review screen became a second caller. Everything still here
 * is Tiptap's: reading a selection out of a document, and writing an answer
 * back through editor commands. A screen with plain inputs shares the call and
 * none of that.
 */

function getLocaleFromEditor(editor: Editor) {
  const dir = editor.view.dom.getAttribute("dir")
  return dir === "rtl" ? "ar" : "en"
}

function setGenerationState(
  editor: Editor,
  loading: boolean,
  hasMessage: boolean,
) {
  const commands = editor.commands as unknown as {
    aiGenerationSetIsLoading?: (loading: boolean) => boolean
    aiGenerationHasMessage?: (hasMessage: boolean) => boolean
  }

  commands.aiGenerationSetIsLoading?.(loading)
  commands.aiGenerationHasMessage?.(hasMessage)
}

/** One transformation, applied to the editor's selection or its whole document. */
export async function runAiEditorAction({
  action,
  editor,
  prompt,
}: {
  action: AiAction
  editor: Editor
  prompt?: string
}) {
  const { from, to, empty } = editor.state.selection
  const selectedText = empty
    ? ""
    : editor.state.doc.textBetween(from, to, "\n\n").trim()

  const client = getApolloClient()
  if (!client) {
    // Before `TokenRefreshProvider` has mounted. Rare, but a toolbar press in
    // that window must read as "try again", not as a crash inside the editor.
    throw new EditorAiError("startingUp")
  }

  setGenerationState(editor, true, false)

  let html: string | null | undefined
  try {
    const { data } = await client.mutate<AiTextData>({
      mutation: AI_TEXT_TRANSFORM,
      variables: {
        input: {
          action: AI_ACTION_ENUM[action],
          prompt,
          locale: getLocaleFromEditor(editor),
          selected_text: selectedText,
          document_html: editor.getHTML(),
        },
      },
      // A rewrite is never a cache read, and caching one would hand the same
      // paragraph back for a second press of the same button.
      fetchPolicy: "no-cache",
    })
    html = data?.aiEditorTransform.success ? data.aiEditorTransform.html : null
  } catch (error) {
    // The loading flag has to come down on every path, or the editor's AI menu
    // stays spinning until the page is reloaded.
    setGenerationState(editor, false, false)
    throw error instanceof Error ? error : new EditorAiError("requestFailed")
  }

  if (!html) {
    setGenerationState(editor, false, false)
    throw new EditorAiError("requestFailed")
  }

  if (!empty && selectedText) {
    editor.chain().focus().insertContentAt({ from, to }, html).run()
  } else {
    editor.commands.setContent(html)
  }

  setGenerationState(editor, false, true)
}
