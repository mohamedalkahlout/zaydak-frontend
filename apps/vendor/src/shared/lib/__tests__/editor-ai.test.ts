import { describe, expect, it } from "vitest"

import { AI_ACTIONS, EditorAiError, aiErrorDescription } from "../editor-ai"
import { enTranslator } from "@/shared/test/next-intl"

const t = enTranslator("editor.ai")

describe("aiErrorDescription", () => {
  it("translates the editor's own failures from the catalogue", () => {
    expect(aiErrorDescription(new EditorAiError("startingUp"), t)).toBe(
      "The editor is still starting up. Try again in a moment.",
    )
    expect(aiErrorDescription(new EditorAiError("requestFailed"), t)).toBe(
      "The AI request failed.",
    )
  })

  it("keeps an API error in its own words", () => {
    expect(aiErrorDescription(new Error("Your plan does not include AI."), t)).toBe(
      "Your plan does not include AI.",
    )
  })

  it("falls back to a generic retry for anything that is not an Error", () => {
    expect(aiErrorDescription("boom", t)).toBe("Please try again")
  })
})

describe("AI_ACTIONS", () => {
  it("has a label in the catalogue for every quick action", () => {
    expect(AI_ACTIONS.map((action) => t(`actions.${action.id}`))).toEqual([
      "Improve",
      "Shorten",
      "Extend",
      "Simplify",
      "To English",
      "To Arabic",
    ])
  })
})
