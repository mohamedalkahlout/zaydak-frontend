import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// The AI block over the metafields card. What is worth pinning after the
// localization pass is that its copy comes out of `en.json` rather than out of
// string concatenation — in particular the count line, which used to be
// `{n} suggestion{n === 1 ? "" : "s"}` and is now an ICU plural the Arabic
// catalogue answers with six forms of its own.

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { SuggestionBanner } from "../form/cards/attribute-values-card"
import type { AttributeSuggestionsApi } from "../form/cards/use-attribute-suggestions"
import type {
  AttributeDefinition,
  AttributeSuggestion,
} from "@/features/products/types"

function definition(
  key: string,
  name: string,
  extra: Partial<AttributeDefinition> = {},
): AttributeDefinition {
  return {
    id: key,
    key,
    name: { en: name },
    type: "TEXT",
    required: false,
    filterable: false,
    sort_order: 0,
    options: [],
    version: 1,
    system_category_id: "cat-1",
    ...extra,
  }
}

const DEFINITIONS = [
  definition("scent_family", "Scent family"),
  definition("volume", "Volume"),
]

const suggestion = (key: string, text: string): AttributeSuggestion => ({
  key,
  type: "TEXT",
  value_text: text,
})

function api(overrides: Partial<AttributeSuggestionsApi> = {}) {
  return {
    status: "ready",
    pending: [],
    suggestionFor: () => undefined,
    accept: vi.fn(),
    acceptAll: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  } as AttributeSuggestionsApi
}

describe("SuggestionBanner", () => {
  it("says what it is doing while the model is reading the product", () => {
    render(
      <SuggestionBanner
        suggestions={api({ status: "loading" })}
        definitions={DEFINITIONS}
      />,
    )
    expect(screen.getByText("Looking at this product…")).toBeDefined()
  })

  it("offers a retry only when the provider actually fell over", () => {
    const retry = vi.fn()
    render(
      <SuggestionBanner
        suggestions={api({ status: "unavailable", retry })}
        definitions={DEFINITIONS}
      />,
    )
    expect(
      screen.getByText("Suggestions are unavailable right now."),
    ).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("names a platform budget refusal without offering retry", () => {
    render(
      <SuggestionBanner
        suggestions={api({ status: "quota", retry: vi.fn() })}
        definitions={DEFINITIONS}
      />,
    )
    expect(
      screen.getByText(
        "AI suggestions are paused for today. They resume at midnight UTC.",
      ),
    ).toBeDefined()
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
  })

  it("renders nothing at all when there is nothing to propose", () => {
    const { container } = render(
      <SuggestionBanner suggestions={api()} definitions={DEFINITIONS} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("counts the proposals through the ICU plural, singular and not", () => {
    const { unmount } = render(
      <SuggestionBanner
        suggestions={api({ pending: [suggestion("volume", "100 ml")] })}
        definitions={DEFINITIONS}
      />,
    )
    expect(screen.getByText("1 suggestion available")).toBeDefined()
    unmount()

    render(
      <SuggestionBanner
        suggestions={api({
          pending: [
            suggestion("scent_family", "Floral"),
            suggestion("volume", "100 ml"),
          ],
        })}
        definitions={DEFINITIONS}
      />,
    )
    expect(screen.getByText("2 suggestions available")).toBeDefined()
  })

  it("wires the whole-banner actions to the hook", () => {
    const acceptAll = vi.fn()
    const dismissAll = vi.fn()
    render(
      <SuggestionBanner
        suggestions={api({
          pending: [suggestion("scent_family", "Floral")],
          acceptAll,
          dismissAll,
        })}
        definitions={DEFINITIONS}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }))
    expect(acceptAll).toHaveBeenCalledTimes(1)

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss all suggestions" }),
    )
    expect(dismissAll).toHaveBeenCalledTimes(1)
  })

  it("names the field in the per-row dismiss, so a screen reader can tell two rows apart", () => {
    const dismiss = vi.fn()
    const accept = vi.fn()
    render(
      <SuggestionBanner
        suggestions={api({
          pending: [
            suggestion("scent_family", "Floral"),
            suggestion("volume", "100 ml"),
          ],
          accept,
          dismiss,
        })}
        definitions={DEFINITIONS}
      />,
    )

    // The placeholder is filled from the definition's own translated name, not
    // glued on around it — which is what lets Arabic put the noun first.
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss suggestion for Volume" }),
    )
    expect(dismiss).toHaveBeenCalledWith("volume")

    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]!)
    expect(accept).toHaveBeenCalledWith("scent_family")
  })

  it("skips a proposal whose definition is no longer in the schema", () => {
    render(
      <SuggestionBanner
        suggestions={api({
          pending: [
            suggestion("scent_family", "Floral"),
            suggestion("gone", "Whatever"),
          ],
        })}
        definitions={DEFINITIONS}
      />,
    )
    // Still counted — the count is the hook's, and the row is what cannot be
    // drawn without a definition to name it.
    expect(screen.getByText("2 suggestions available")).toBeDefined()
    expect(screen.getAllByRole("button", { name: "Accept" })).toHaveLength(1)
  })
})
