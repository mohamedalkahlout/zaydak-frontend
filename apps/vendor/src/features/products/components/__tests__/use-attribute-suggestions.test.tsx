import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"

// The AI suggestion layer over the category metafields card.
//
// Two things are worth pinning and neither is the banner's looks. **What it
// costs** — the request fires once per category and not at all when there is
// nothing to fill or no title to read, because this spends a model call and a
// unit of the shop's monthly allowance every time it runs. And **what it is
// allowed to touch** — a suggestion may only ever land in an empty field, so a
// merchant's own answer survives a proposal that arrives after it.

import type { AttributeDefinition } from "@/features/products/types"
import type { AttributeValueEntryInput } from "@/features/products/validations/product"

const fixtures = vi.hoisted(() => ({
  /** Resolves the next mutation call. Replaced per test. */
  mutate: vi.fn(),
  loading: false,
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [fixtures.mutate, { loading: fixtures.loading }],
}))

const { useAttributeSuggestions } = await import(
  "../form/cards/use-attribute-suggestions"
)

// ── Fixtures ────────────────────────────────────────────────────────

const def = (
  over: Partial<AttributeDefinition> & Pick<AttributeDefinition, "key" | "type">,
): AttributeDefinition => ({
  id: `def-${over.key}`,
  name: { en: over.key },
  required: false,
  filterable: true,
  sort_order: 0,
  options: [],
  version: 1,
  system_category_id: "cat-perfume",
  ...over,
})

const DEFINITIONS: AttributeDefinition[] = [
  def({
    key: "dispenser_type",
    type: "SELECT",
    name: { en: "Dispenser type" },
    options: [
      { id: "o1", value: "spray", label: { en: "Spray" }, sort_order: 0 },
      { id: "o2", value: "roll_on", label: { en: "Roll-on" }, sort_order: 1 },
    ],
  }),
  def({ key: "scent", type: "TEXT", name: { en: "Scent" } }),
]

const SUGGESTIONS = [
  { key: "dispenser_type", type: "SELECT" as const, value_option: "spray" },
  { key: "scent", type: "TEXT" as const, value_text: "Oud" },
]

/**
 * A form stand-in with real value storage, so "did it write" and "did it
 * refuse to overwrite" are answered by the same object the hook talks to.
 */
function makeForm(initial: Record<string, AttributeValueEntryInput> = {}) {
  const state: Record<string, unknown> = {
    name: { en: "Midnight Oud 100ml" },
    description: { en: "A woody fragrance." },
    brand: "Acme",
    attribute_values: initial,
  }
  const setValue = vi.fn(
    (field: string, value: unknown) => {
      state[field] = value
    },
  )
  return {
    form: {
      getValues: (field: string) => state[field],
      setValue,
      control: {},
      formState: { errors: {} },
    } as never,
    state,
    setValue,
  }
}

/** Scripts the mutation to answer with `data`, through Apollo's own callback. */
function answerWith(
  payload:
    | { data?: typeof SUGGESTIONS; generated?: boolean }
    | "error"
    | "quota",
) {
  fixtures.mutate.mockImplementation(
    (opts: {
      onCompleted?: (d: unknown) => void
      onError?: (e: unknown) => void
    }) => {
      if (payload === "error") opts.onError?.(new Error("502"))
      else if (payload === "quota")
        opts.onError?.(
          new CombinedGraphQLErrors({
            errors: [
              {
                message: "Validation failed",
                extensions: {
                  error_code: "VALIDATION_ERROR",
                  validation_errors: [
                    {
                      field: "ai",
                      code: "AI_BUDGET_EXCEEDED",
                      messages: ["Platform AI budget exhausted"],
                    },
                  ],
                },
              },
            ],
          }),
        )
      else
        opts.onCompleted?.({
          suggestProductAttributes: {
            success: true,
            generated: payload.generated ?? true,
            data: payload.data ?? SUGGESTIONS,
          },
        })
      return Promise.resolve({})
    },
  )
}

function setup({
  values = {} as Record<string, AttributeValueEntryInput>,
  definitions = DEFINITIONS,
  systemCategoryId = "cat-perfume" as string | undefined,
  form = makeForm(values),
} = {}) {
  const view = renderHook(
    (props: { values: Record<string, AttributeValueEntryInput>; categoryId?: string }) =>
      useAttributeSuggestions({
        form: form.form,
        definitions,
        values: props.values,
        systemCategoryId: props.categoryId,
      }),
    { initialProps: { values, categoryId: systemCategoryId } },
  )
  return { ...view, form }
}

beforeEach(() => {
  fixtures.mutate.mockReset()
  fixtures.loading = false
  answerWith({})
})

// ── What it costs ───────────────────────────────────────────────────

describe("useAttributeSuggestions — spend", () => {
  it("asks once per category, however often it re-renders", async () => {
    const { result, rerender } = setup()

    await waitFor(() => expect(result.current.pending).toHaveLength(2))
    rerender({ values: {}, categoryId: "cat-perfume" })
    rerender({ values: {}, categoryId: "cat-perfume" })

    expect(fixtures.mutate).toHaveBeenCalledTimes(1)
  })

  it("asks again when the merchant picks a different category", async () => {
    const { result, rerender } = setup()
    await waitFor(() => expect(result.current.pending).toHaveLength(2))

    rerender({ values: {}, categoryId: "cat-watches" })

    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalledTimes(2))
  })

  it("spends nothing when every field is already answered", () => {
    setup({
      values: {
        dispenser_type: { option: "spray" },
        scent: { text: "Oud" },
      },
    })

    // The merchant editing a complete product is the common case on an edit
    // screen; billing them a unit for opening it would be indefensible.
    expect(fixtures.mutate).not.toHaveBeenCalled()
  })

  it("spends nothing on a product with no title to read", () => {
    const form = makeForm()
    ;(form.state as Record<string, unknown>).name = { en: "  " }

    setup({ form })

    expect(fixtures.mutate).not.toHaveBeenCalled()
  })

  it("tells the server which fields not to ask about", async () => {
    const { result } = setup({ values: { scent: { text: "Oud" } } })
    await waitFor(() => expect(result.current.pending.length).toBeGreaterThan(0))

    expect(fixtures.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({ skip_keys: ["scent"] }),
        }),
      }),
    )
  })
})

// ── What it is allowed to touch ─────────────────────────────────────

describe("useAttributeSuggestions — accepting", () => {
  it("writes an accepted value and dirties the form", async () => {
    const { result, form } = setup()
    await waitFor(() => expect(result.current.pending).toHaveLength(2))

    act(() => result.current.accept("scent"))

    // `shouldDirty` is the handover to the contextual save bar — without it a
    // suggestion would be silently discarded on navigate, or worse, saved by
    // something else.
    expect(form.setValue).toHaveBeenCalledWith(
      "attribute_values",
      expect.objectContaining({ scent: { text: "Oud" } }),
      { shouldDirty: true },
    )
    expect(result.current.pending.map((s) => s.key)).toEqual(["dispenser_type"])
  })

  it("accepts every pending proposal at once", async () => {
    const { result, form } = setup()
    await waitFor(() => expect(result.current.pending).toHaveLength(2))

    act(() => result.current.acceptAll())

    expect(form.state.attribute_values).toEqual({
      dispenser_type: { option: "spray" },
      scent: { text: "Oud" },
    })
    expect(result.current.pending).toHaveLength(0)
  })

  it("never overwrites an answer the merchant typed while it was thinking", async () => {
    const { result, rerender, form } = setup()
    await waitFor(() => expect(result.current.pending).toHaveLength(2))

    // The merchant fills the field themselves before deciding on the proposal.
    const typed = { scent: { text: "Vanilla" } }
    ;(form.state as Record<string, unknown>).attribute_values = typed
    rerender({ values: typed, categoryId: "cat-perfume" })

    // It disappears from the banner rather than offering to replace a value.
    expect(result.current.pending.map((s) => s.key)).toEqual(["dispenser_type"])

    act(() => result.current.acceptAll())
    expect(form.state.attribute_values).toEqual({
      scent: { text: "Vanilla" },
      dispenser_type: { option: "spray" },
    })
  })

  it("forgets a dismissed proposal without touching the form", async () => {
    const { result, form } = setup()
    await waitFor(() => expect(result.current.pending).toHaveLength(2))

    act(() => result.current.dismiss("scent"))

    expect(result.current.pending.map((s) => s.key)).toEqual(["dispenser_type"])
    expect(form.setValue).not.toHaveBeenCalled()
  })
})

// ── Reporting ───────────────────────────────────────────────────────

describe("useAttributeSuggestions — status", () => {
  it("separates a provider that fell over from a model with nothing to add", async () => {
    answerWith({ data: [], generated: false })
    const { result } = setup()

    // `unavailable` is what earns the retry affordance; an empty `ready` shows
    // nothing at all, because "no confident answer" is not worth interrupting
    // a product form over.
    await waitFor(() => expect(result.current.status).toBe("unavailable"))

    answerWith({ data: [], generated: true })
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.pending).toHaveLength(0)
  })

  it("reports a failed request as unavailable rather than throwing", async () => {
    answerWith("error")
    const { result } = setup()

    await waitFor(() => expect(result.current.status).toBe("unavailable"))
    expect(result.current.pending).toHaveLength(0)
  })

  it("reports a platform budget refusal as quota rather than unavailable", async () => {
    answerWith("quota")
    const { result } = setup()

    await waitFor(() => expect(result.current.status).toBe("quota"))
    expect(result.current.pending).toHaveLength(0)
  })

  it("drops a slow answer for the category the merchant already left", async () => {
    // Hold the first category's callback so it can land after the switch.
    let late: (() => void) | null = null
    fixtures.mutate.mockImplementation(
      (opts: { onCompleted?: (d: unknown) => void; variables: { input: { system_category_id: string } } }) => {
        const forCategory = opts.variables.input.system_category_id
        const fire = () =>
          opts.onCompleted?.({
            suggestProductAttributes: {
              success: true,
              generated: true,
              data: [
                {
                  key: "scent",
                  type: "TEXT",
                  value_text: `from ${forCategory}`,
                },
              ],
            },
          })
        if (forCategory === "cat-perfume") late = fire
        else fire()
        return Promise.resolve({})
      },
    )

    const { result, rerender } = setup()
    rerender({ values: {}, categoryId: "cat-watches" })
    await waitFor(() => expect(result.current.pending).toHaveLength(1))

    act(() => late?.())

    // Still the second category's answer — a stale one painted over these
    // fields would propose a perfume's scent on a watch.
    expect(result.current.pending[0]).toMatchObject({
      value_text: "from cat-watches",
    })
  })
})
