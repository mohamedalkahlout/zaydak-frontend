import { gql } from "@apollo/client"

/**
 * The platform's one text-AI call, and its vocabulary.
 *
 * Split out of `editor-ai.ts` when a second caller appeared. That module is
 * bound to Tiptap all the way down — it takes an `Editor`, reads its selection,
 * and writes the answer back with editor commands — so the store-import review
 * screen, which has plain `<input>`s and a staged draft, could not reuse a line
 * of it. What both callers genuinely share is this: one mutation document, one
 * action vocabulary, and one translation of that vocabulary into the API's
 * enum. Those live here; everything about how an answer is *applied* stays with
 * the caller, because that is the part that differs.
 *
 * The mutation is billed per character against `ai.text.rewrite`,
 * `ai.text.summarize`, `ai.text.translate` or `ai.text.generate` depending on
 * the action, and runs behind the platform's whole gate chain — session, shop
 * ownership, plan quota, per-user rate limit, daily budget, output moderation
 * and usage accounting. None of that is optional and none of it is here: it is
 * on the resolver, which is the point of the mutation existing at all.
 */
export const AI_TEXT_TRANSFORM = gql`
  mutation AiEditorTransform($input: AiEditorInput!) {
    aiEditorTransform(input: $input) {
      success
      html
    }
  }
`

export type AiAction =
  | "improve"
  | "shorten"
  | "extend"
  | "simplify"
  | "translate-en"
  | "translate-ar"
  | "custom"

/** The API's enum. The union above is this app's own public vocabulary. */
export const AI_ACTION_ENUM: Record<AiAction, string> = {
  improve: "IMPROVE",
  shorten: "SHORTEN",
  extend: "EXTEND",
  simplify: "SIMPLIFY",
  "translate-en": "TRANSLATE_EN",
  "translate-ar": "TRANSLATE_AR",
  custom: "CUSTOM",
}

/**
 * What shape of answer the caller needs.
 *
 * The seven actions were written for a rich-text document and say so in the
 * prompt. `PLAIN_LINE` is what a single-line field asks for instead — a product
 * title improved as `RICH_TEXT` came back as a paragraph wrapped in `<p>`, and
 * a caller stripping the tags was left with prose where a title belongs.
 */
export type AiTarget = "RICH_TEXT" | "PLAIN_LINE"

export interface AiTextVariables {
  input: {
    action: string
    document_html?: string
    selected_text?: string
    prompt?: string
    locale?: string
    target?: AiTarget
    max_length?: number
  }
}

/** Build the mutation's variables. Shared so the two callers cannot drift. */
export function aiTextVariables(args: {
  action: AiAction
  /** The text being transformed. HTML for a document, plain for a line. */
  source: string
  /** Narrows a document transform to one passage. */
  selection?: string
  prompt?: string
  locale?: string
  target?: AiTarget
  maxLength?: number
}): AiTextVariables {
  return {
    input: {
      action: AI_ACTION_ENUM[args.action],
      document_html: args.source,
      ...(args.selection ? { selected_text: args.selection } : {}),
      ...(args.prompt ? { prompt: args.prompt } : {}),
      ...(args.locale ? { locale: args.locale } : {}),
      ...(args.target ? { target: args.target } : {}),
      ...(args.maxLength ? { max_length: args.maxLength } : {}),
    },
  }
}

export interface AiTextData {
  aiEditorTransform: { success: boolean; html?: string | null }
}
