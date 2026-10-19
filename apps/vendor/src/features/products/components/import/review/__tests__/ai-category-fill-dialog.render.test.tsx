import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type {
  StoreImportField,
  StoreImportProduct,
} from "@/features/products/api"
import type { ReviewDraft } from "@/features/products/lib/store-import-review"

/**
 * "Suggest categories for this page", as the merchant meets it.
 *
 * The three promises the dialog makes are the three things tested: nothing is
 * spent before the estimate is confirmed, the requests go one at a time and
 * Stop sends no more, and a refusal part-way keeps what was already filled.
 * Throughout, a suggestion is a staged edit — the draft is what changes, and
 * nothing here saves.
 */

const h = vi.hoisted(() => ({ suggest: vi.fn() }))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [h.suggest, { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { AiCategoryFillDialog } from "../ai-category-fill-dialog"

const field = (over: Partial<StoreImportField>): StoreImportField => ({
  key: "name_en",
  kind: "text",
  group: "product",
  never_scanned: false,
  blocks_sale: false,
  bulk_fillable: false,
  max_length: null,
  reference_key: null,
  ...over,
})

const FIELDS: StoreImportField[] = [
  field({ key: "name_en" }),
  field({ key: "description_en", kind: "multiline" }),
  field({ key: "brand" }),
  field({
    key: "system_category_id",
    kind: "category",
    group: "organization",
    never_scanned: true,
    blocks_sale: true,
    bulk_fillable: true,
  }),
]

const product = (
  handle: string,
  over: Partial<StoreImportProduct> = {},
): StoreImportProduct => ({
  handle,
  position: 0,
  scanned: { name_en: `Product ${handle}` },
  edited: {},
  excluded: false,
  image_url: null,
  images: [],
  gallery_count: 0,
  dropped_images: [],
  image_order: [],
  variant_count: 0,
  shares_variant_row: false,
  incomplete: true,
  ...over,
})

const page = (count: number): StoreImportProduct[] =>
  Array.from({ length: count }, (_, index) => product(`p-${index + 1}`))

type Call = { variables: { input: { products: { ref: string }[] } } }

/** The server's answer for one request: every product placed, decisively. */
const placed = (call: Call, decisive = true) => ({
  data: {
    suggestSystemCategories: {
      success: true,
      generated: true,
      data: call.variables.input.products.map((item) => ({
        ref: item.ref,
        decisive,
        categories: [
          {
            id: `cat-${item.ref}`,
            name: "Mugs",
            label: "Home > Mugs",
            level: 2,
          },
        ],
      })),
    },
  },
})

/** The per-user limiter's refusal, as the API sends it. */
const rateLimited = () => {
  const errors = [
    {
      message: "Validation failed",
      extensions: {
        error_code: "VALIDATION_ERROR",
        validation_errors: [{ field: "ai", code: "AI_RATE_LIMITED" }],
      },
    },
  ]
  return new CombinedGraphQLErrors({ errors }, errors)
}

/** The screen's half: it owns the draft the dialog stages into. */
function Harness({
  products,
  busy = false,
}: {
  products: StoreImportProduct[]
  busy?: boolean
}) {
  const [draft, setDraft] = useState<ReviewDraft>({})
  return (
    <>
      <AiCategoryFillDialog
        products={products}
        draft={draft}
        fields={FIELDS}
        busy={busy}
        onStage={setDraft}
      />
      <output data-testid="staged">
        {Object.keys(draft)
          .filter((handle) => draft[handle]?.fields?.system_category_id)
          .join(",")}
      </output>
    </>
  )
}

const staged = () =>
  (screen.getByTestId("staged").textContent ?? "").split(",").filter(Boolean)

const open = () =>
  fireEvent.click(screen.getByRole("button", { name: "Suggest categories" }))

describe("AiCategoryFillDialog", () => {
  beforeEach(() => {
    h.suggest.mockReset()
    h.suggest.mockImplementation((call: Call) => Promise.resolve(placed(call)))
  })

  it("states the estimate first and spends nothing until it is confirmed", () => {
    const products = [
      ...page(28),
      product("has-one", {
        scanned: { name_en: "Mug", system_category_id: "cat-9" },
      }),
      product("left-out", { excluded: true }),
    ]
    render(<Harness products={products} />)
    open()

    expect(
      screen.getByText("28 products on this page have no category yet."),
    ).toBeTruthy()
    expect(
      screen.getByText(
        "This sends 2 AI requests, one after another, with up to 25 products in each.",
      ),
    ).toBeTruthy()
    // What it counts against, and what it does not.
    expect(
      screen.getByText(
        "Each request counts toward the 30 AI requests your account can make in an hour, shared with every other AI action.",
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        "Suggesting categories is free on every plan. It uses none of your plan's AI allowance.",
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        "2 products on this page are skipped: they already have a category, are left out, or have no title.",
      ),
    ).toBeTruthy()
    expect(h.suggest).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(h.suggest).not.toHaveBeenCalled()
    expect(staged()).toEqual([])
  })

  it("sends the batches one after another and stages what comes back", async () => {
    render(<Harness products={page(28)} />)
    open()
    fireEvent.click(
      screen.getByRole("button", { name: "Suggest for 28 products" }),
    )

    await waitFor(() =>
      expect(screen.getByText("Filled in 28 categories.")).toBeTruthy(),
    )
    expect(h.suggest).toHaveBeenCalledTimes(2)
    expect(
      h.suggest.mock.calls.map(
        ([call]) => (call as Call).variables.input.products.length,
      ),
    ).toEqual([25, 3])
    // Staged like a typed edit — and said so, because nothing was saved.
    expect(staged()).toHaveLength(28)
    expect(
      screen.getByText("Check the new categories, then press Save."),
    ).toBeTruthy()
  })

  it("stops between requests: the one in flight finishes, no more are sent", async () => {
    let finishFirst: (value: unknown) => void = () => {}
    h.suggest.mockImplementationOnce(
      (call: Call) =>
        new Promise((resolve) => {
          finishFirst = () => resolve(placed(call))
        }),
    )
    render(<Harness products={page(28)} />)
    open()
    fireEvent.click(
      screen.getByRole("button", { name: "Suggest for 28 products" }),
    )
    expect(screen.getByText("Sending request 1 of 2…")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Stop" }))
    expect(screen.getByText("Stopping after this request…")).toBeTruthy()
    finishFirst(undefined)

    await waitFor(() =>
      expect(screen.getByText("Filled in 25 categories.")).toBeTruthy(),
    )
    expect(
      screen.getByText("You stopped it before 3 products were asked about."),
    ).toBeTruthy()
    expect(h.suggest).toHaveBeenCalledTimes(1)
    // What the finished request answered is kept.
    expect(staged()).toHaveLength(25)
  })

  it("ends cleanly on a refusal part-way, keeping what was filled", async () => {
    h.suggest
      .mockImplementationOnce((call: Call) => Promise.resolve(placed(call)))
      .mockImplementationOnce(() => Promise.reject(rateLimited()))
    render(<Harness products={page(60)} />)
    open()
    fireEvent.click(
      screen.getByRole("button", { name: "Suggest for 60 products" }),
    )

    await waitFor(() =>
      expect(screen.getByText("Filled in 25 categories.")).toBeTruthy(),
    )
    expect(
      screen.getByText(
        "Too many AI requests just now. Wait a little and try again.",
      ),
    ).toBeTruthy()
    expect(screen.getByText("35 products were not asked about.")).toBeTruthy()
    // The third request was never sent.
    expect(h.suggest).toHaveBeenCalledTimes(2)
    expect(staged()).toHaveLength(25)
  })

  it("stops when no provider answered, rather than spending the next request", async () => {
    h.suggest.mockResolvedValueOnce({
      data: {
        suggestSystemCategories: { success: true, generated: false, data: [] },
      },
    })
    render(<Harness products={page(28)} />)
    open()
    fireEvent.click(
      screen.getByRole("button", { name: "Suggest for 28 products" }),
    )

    await waitFor(() =>
      expect(
        screen.getByText("That AI request failed. Try again in a moment."),
      ).toBeTruthy(),
    )
    expect(h.suggest).toHaveBeenCalledTimes(1)
    expect(screen.getByText("No category was filled in.")).toBeTruthy()
    expect(staged()).toEqual([])
  })

  it("leaves an answer AI is not sure of for a person to choose", async () => {
    h.suggest.mockImplementation((call: Call) =>
      Promise.resolve(placed(call, false)),
    )
    render(<Harness products={page(2)} />)
    open()
    fireEvent.click(
      screen.getByRole("button", { name: "Suggest for 2 products" }),
    )

    await waitFor(() =>
      expect(screen.getByText("No category was filled in.")).toBeTruthy(),
    )
    expect(
      screen.getByText(
        "2 products could go in more than one category. Open each one and use Suggest a category to choose.",
      ),
    ).toBeTruthy()
    expect(staged()).toEqual([])
  })

  it("caps one run and says how many are left for the next", () => {
    render(<Harness products={page(120)} />)
    open()

    expect(
      screen.getByText(
        "This sends 4 AI requests, one after another, with up to 25 products in each.",
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        "20 more products are past the limit for one run. Run it again for the rest.",
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Suggest for 100 products" }),
    ).toBeTruthy()
  })

  it("offers nothing to confirm when every product already has an answer", () => {
    render(
      <Harness
        products={[
          product("done", {
            scanned: { name_en: "Mug", system_category_id: "cat-1" },
          }),
        ]}
      />,
    )
    open()

    expect(
      screen.getByText(
        "Every product on this page already has a category, is left out, or has no title. There is nothing to ask about.",
      ),
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Suggest for/ })).toBeNull()
    expect(h.suggest).not.toHaveBeenCalled()
  })

  it("is unavailable while another call is in flight on the screen", () => {
    render(<Harness products={page(3)} busy />)
    expect(
      (
        screen.getByRole("button", {
          name: "Suggest categories",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
  })
})
