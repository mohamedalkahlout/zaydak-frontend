import { beforeEach, describe, expect, it } from "vitest"

import { useAssistantStore } from "../store"

/**
 * What the panel was opened about. A price is agreed per option of a product,
 * so "negotiate" pressed with red L selected sends red L beside the product —
 * and only beside it: an option alone names nothing.
 */
describe("assistant store — the subject the panel was opened about", () => {
  beforeEach(() => {
    useAssistantStore.setState({
      open: false,
      pendingPrompt: null,
      subjectProductSlug: null,
      subjectVariationId: null,
      messages: [],
      history: [],
    })
  })

  it("keeps the option selected on the page beside its product", () => {
    useAssistantStore.getState().openWithPrompt("بدي أفاوض", "qamis", "v-rl")

    expect(useAssistantStore.getState()).toMatchObject({
      open: true,
      pendingPrompt: "بدي أفاوض",
      subjectProductSlug: "qamis",
      subjectVariationId: "v-rl",
    })
  })

  it("never keeps an option without the product it belongs to", () => {
    useAssistantStore.getState().openWithPrompt("hello", null, "v-rl")

    expect(useAssistantStore.getState().subjectVariationId).toBeNull()
  })

  it("forgets both when a new conversation starts", () => {
    useAssistantStore.getState().openWithPrompt("بدي أفاوض", "qamis", "v-rl")
    useAssistantStore.getState().startNew()

    expect(useAssistantStore.getState()).toMatchObject({
      subjectProductSlug: null,
      subjectVariationId: null,
    })
  })
})
