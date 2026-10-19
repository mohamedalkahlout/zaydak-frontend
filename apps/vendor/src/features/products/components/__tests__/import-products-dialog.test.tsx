import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

/**
 * Two things this pins.
 *
 * The conflict screen is **conditional on the check**, not on the file: a
 * file whose handles are all new must never be asked whether it may
 * overwrite something, and a file that does collide must be stopped and told
 * which products.
 *
 * And the commit is the report's own run — same file, same answer, `dry_run`
 * off. If the second call ever stopped matching the last dry run, a merchant
 * would approve one reading of their CSV and get another.
 */

const { runImport, createStoreImport, push } = vi.hoisted(() => ({
  runImport: vi.fn(),
  createStoreImport: vi.fn(),
  push: vi.fn(),
}))

// Keyed by operation name, because the dialog now holds two mutations and the
// CSV assertions below count calls: one shared spy would have the store branch
// and the importer writing into the same tally.
vi.mock("@apollo/client/react", () => ({
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    return [
      name === "CreateStoreImport" ? createStoreImport : runImport,
      { loading: false },
    ]
  },
  useQuery: () => ({ data: undefined }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ shopSlug: "acme" }),
}))

// Real messages rather than a key echo: every assertion below is on the copy a
// merchant reads, and a key that was never written to `en.json` has to fail
// here rather than quietly render its own name.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/shared/hooks/use-shop-currency", () => ({
  useShopCurrency: () => "SAR",
}))

import { ImportProductsDialog } from "../list/import-products-dialog"

const CSV = "Title,URL handle,Price\nTee,tee,19.99"

const CLEAN = {
  success: true,
  total_rows: 12,
  products: 3,
  skus: 16,
  images: 2,
  created: 3,
  updated: 0,
  skipped: 0,
  errors: 0,
  dry_run: true,
  unmapped_headers: [],
  preview: {
    title: "Classic Cotton T-Shirt",
    description: "A soft mid-weight cotton tee.",
    status: "PUBLISH",
    product_type: "VARIABLE",
    category: "Apparel & Accessories > Clothing",
    brand: "Acme",
    image_url: null,
    variants: [
      {
        title: "Small / Black",
        sku: "TEE-S-BLACK",
        weight_grams: 150,
        price_cents: 1999,
      },
    ],
  },
  rows: [{ row_number: 2, slug: "tee", action: "create", variants: 1 }],
}

/** Two handles the shop already sells, plus one row that is simply invalid. */
const CONFLICTED = {
  ...CLEAN,
  created: 1,
  skipped: 2,
  errors: 1,
  rows: [
    {
      row_number: 2,
      slug: "classic-cotton-t-shirt",
      action: "skip",
      product_id: "p_1",
      errors: [
        { field: "slug", message: "A product with this handle exists." },
      ],
    },
    {
      row_number: 6,
      slug: "steel-bottle",
      action: "skip",
      product_id: "p_2",
      errors: [
        { field: "slug", message: "A product with this handle exists." },
      ],
    },
    {
      row_number: 9,
      slug: "no-title",
      action: "skip",
      errors: [{ field: "name_en", message: "Title is required." }],
    },
    { row_number: 11, slug: "new-thing", action: "create" },
  ],
}

const reply = (result: unknown) => ({ data: { importProductsCsv: result } })

/** The dialog opens on the source step; the file input is one screen in. */
function goToFileStep() {
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
}

async function pickFile() {
  // The dialog renders in a portal, so the input is on `document`, not in
  // the container `render` hands back.
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  const file = new File([CSV], "products.csv", { type: "text/csv" })
  // jsdom's File has no usable `text()`; the dialog reads the body with it.
  Object.defineProperty(file, "text", { value: () => Promise.resolve(CSV) })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(screen.getByText("products.csv")).toBeDefined())
}

async function uploadAndCheck() {
  fireEvent.click(screen.getByRole("button", { name: "Upload and continue" }))
  await waitFor(() => expect(runImport).toHaveBeenCalled())
}

async function openWithFile() {
  render(<ImportProductsDialog open onOpenChange={() => {}} />)
  goToFileStep()
  await pickFile()
}

async function reachConflictStep() {
  runImport.mockResolvedValue(reply(CONFLICTED))
  await openWithFile()
  await uploadAndCheck()
  await waitFor(() =>
    expect(
      screen.getByText("Some of these products already exist"),
    ).toBeDefined(),
  )
}

const inputOf = (call: number) =>
  runImport.mock.calls[call][0].variables.input as Record<string, unknown>

describe("ImportProductsDialog", () => {
  beforeEach(() => {
    runImport.mockReset()
    runImport.mockResolvedValue(reply(CLEAN))
    createStoreImport.mockReset()
    createStoreImport.mockResolvedValue({
      data: { createStoreImport: { success: true, data: { id: "job_42" } } },
    })
    push.mockReset()
  })

  it("offers the sample CSV on the CSV choice and the file step, and nowhere else", () => {
    render(<ImportProductsDialog open onOpenChange={() => {}} />)
    // The question is the group's name, and the sample file belongs to the
    // choice it explains rather than to the footer.
    expect(
      screen.getByRole("radiogroup", {
        name: "How do you want to import your products?",
      }),
    ).toBeDefined()
    const link = screen.getByRole("link", { name: "Download sample CSV" })
    expect(link.getAttribute("href")).toBe("/sample-products.csv")

    goToFileStep()
    expect(
      screen.getByRole("link", { name: "Download sample CSV" }),
    ).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    fireEvent.click(
      screen.getByRole("radio", { name: /Import from your old online store/ }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByLabelText("Store address")).toBeDefined()
    expect(
      screen.queryByRole("link", { name: "Download sample CSV" }),
    ).toBeNull()
  })

  it("checks the file with a dry run before writing anything", async () => {
    await openWithFile()
    await uploadAndCheck()

    expect(runImport).toHaveBeenCalledTimes(1)
    expect(inputOf(0)).toEqual({
      csv: CSV,
      dry_run: true,
      // The check always asks the non-destructive question first — that is
      // what makes the collisions visible enough to ask about.
      overwrite_existing: false,
      publish_new: true,
    })
  })

  it("asks nothing about overwriting when no handle collides", async () => {
    await openWithFile()
    await uploadAndCheck()

    await waitFor(() =>
      expect(screen.getByText("Preview your first product")).toBeDefined(),
    )
    expect(
      screen.queryByText("Some of these products already exist"),
    ).toBeNull()
    expect(screen.queryByRole("radio", { name: /Skip them/ })).toBeNull()
  })

  it("renders the counts and the first product's variants", async () => {
    await openWithFile()
    await uploadAndCheck()

    await waitFor(() =>
      expect(screen.getByText("Preview your first product")).toBeDefined(),
    )
    // The sentence a merchant checks before committing — three products, not
    // the twelve rows the file actually holds.
    expect(screen.getByText("3")).toBeDefined()
    expect(screen.getByText("Classic Cotton T-Shirt")).toBeDefined()
    expect(screen.getByText("Small / Black")).toBeDefined()
    expect(screen.getByText("TEE-S-BLACK")).toBeDefined()
    expect(screen.getByText("150 g")).toBeDefined()
  })

  it("stops on the conflict step and names the handles it found", async () => {
    await reachConflictStep()

    expect(screen.getByText("classic-cotton-t-shirt")).toBeDefined()
    expect(screen.getByText("steel-bottle")).toBeDefined()
    // The invalid row is a different problem and does not belong in this list.
    expect(screen.queryByText("no-title")).toBeNull()
  })

  it("skipping the conflicts needs no second read of the file", async () => {
    await reachConflictStep()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() =>
      expect(screen.getByText("Preview your first product")).toBeDefined(),
    )
    expect(runImport).toHaveBeenCalledTimes(1)
  })

  it("overwriting re-reads the file so the preview is the run that will happen", async () => {
    await reachConflictStep()

    fireEvent.click(
      screen.getByRole("radio", { name: /Overwrite them with this file/ }),
    )
    runImport.mockResolvedValue(reply({ ...CLEAN, created: 1, updated: 2 }))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => expect(runImport).toHaveBeenCalledTimes(2))
    expect(inputOf(1)).toMatchObject({
      dry_run: true,
      overwrite_existing: true,
    })
    await waitFor(() =>
      expect(screen.getByText("Preview your first product")).toBeDefined(),
    )
  })

  it("commits the same file and the same answer the preview was built from", async () => {
    await reachConflictStep()
    fireEvent.click(
      screen.getByRole("radio", { name: /Overwrite them with this file/ }),
    )
    runImport.mockResolvedValue(reply({ ...CLEAN, created: 1, updated: 2 }))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => expect(runImport).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole("button", { name: "Import products" }))

    await waitFor(() => expect(runImport).toHaveBeenCalledTimes(3))
    expect(inputOf(2)).toEqual({ ...inputOf(1), dry_run: false })
  })

  it("asks about publishing on the preview, where the count is known", async () => {
    await openWithFile()
    // Nothing on the file step qualifies a file nobody has checked yet.
    expect(screen.queryByRole("checkbox")).toBeNull()

    await uploadAndCheck()
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /Publish the 3 products/ }),
      ).toBeDefined(),
    )

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Publish the 3 products/ }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Import products" }))

    await waitFor(() => expect(runImport).toHaveBeenCalledTimes(2))
    expect(inputOf(1)).toMatchObject({ dry_run: false, publish_new: false })
  })
})

/**
 * The other branch of the same wizard.
 *
 * What is worth pinning here is the attestation: it is the only thing on the
 * form no code can check, the back-end refuses without it before it will even
 * resolve the hostname, and a screen that let a merchant past it would turn a
 * legal statement into a default.
 */
describe("ImportProductsDialog — importing from a store address", () => {
  beforeEach(() => {
    createStoreImport.mockReset()
    createStoreImport.mockResolvedValue({
      data: { createStoreImport: { success: true, data: { id: "job_42" } } },
    })
    push.mockReset()
  })

  function openUrlStep() {
    render(<ImportProductsDialog open onOpenChange={() => {}} />)
    fireEvent.click(
      screen.getByRole("radio", { name: /Import from your old online store/ }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
  }

  it("offers the store as a real choice, not a disabled one", () => {
    render(<ImportProductsDialog open onOpenChange={() => {}} />)
    const radio = screen.getByRole("radio", {
      name: /Import from your old online store/,
    })
    expect(radio.hasAttribute("disabled")).toBe(false)
  })

  it("refuses to scan until the merchant attests ownership", async () => {
    openUrlStep()
    fireEvent.change(screen.getByLabelText("Store address"), {
      target: { value: "https://old-store.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Scan the store" }))

    await screen.findByText(
      "Confirm you may move this store's data before scanning.",
    )
    expect(createStoreImport).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it("sends the attestation and hands over to the progress route", async () => {
    openUrlStep()
    fireEvent.change(screen.getByLabelText("Store address"), {
      target: { value: "https://old-store.com" },
    })
    fireEvent.click(screen.getByRole("checkbox", { name: /I own this store/ }))
    fireEvent.click(screen.getByRole("button", { name: "Scan the store" }))

    await waitFor(() => expect(createStoreImport).toHaveBeenCalled())
    expect(createStoreImport).toHaveBeenCalledWith({
      variables: {
        input: {
          source_url: "https://old-store.com/",
          requested_platform: "AUTO",
          attested_owner: true,
        },
      },
    })
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/store/acme/products/import/job_42"),
    )
  })

  it("never offers a platform it cannot scan", () => {
    openUrlStep()
    expect(screen.queryByText("Salla")).toBeNull()
    expect(screen.queryByText("Zid")).toBeNull()
  })

  it("says plainly that scanning writes nothing", () => {
    render(<ImportProductsDialog open onOpenChange={() => {}} />)
    expect(
      screen.getByText(
        "We read the catalogue at its address and show you what is there. Nothing is written until you approve it.",
      ),
    ).toBeDefined()
  })
})

/**
 * The third source: one product page.
 *
 * Two things matter here more than the plumbing. The scope has to reach the
 * server, or "just this product" becomes a crawl of somebody else's store
 * started from their product page. And the attestation has to be the
 * product's own sentence — the store-migration wording does not say what is
 * being promised about a single listing, and on a competitor's page that
 * promise is the only thing standing in the way.
 */
describe("ImportProductsDialog — importing a single product", () => {
  const PRODUCT_URL = "https://old-store.com/products/blue-mug"

  beforeEach(() => {
    createStoreImport.mockReset()
    createStoreImport.mockResolvedValue({
      data: { createStoreImport: { success: true, data: { id: "job_7" } } },
    })
    push.mockReset()
  })

  function openProductStep() {
    render(<ImportProductsDialog open onOpenChange={() => {}} />)
    fireEvent.click(
      screen.getByRole("radio", { name: /Import a single product/ }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
  }

  function typeUrl(value: string) {
    fireEvent.change(screen.getByLabelText("Product page address"), {
      target: { value },
    })
  }

  it("asks for a product page, with no platform picker", () => {
    openProductStep()
    expect(screen.getByLabelText("Product page address")).toBeDefined()
    expect(screen.queryByLabelText("Store address")).toBeNull()
    expect(screen.queryByText("Platform")).toBeNull()
  })

  it("asks the product's own attestation, and says what is not allowed", () => {
    openProductStep()
    const box = screen.getByRole("checkbox", {
      name: /This product's content is mine/,
    })
    expect(box.getAttribute("aria-describedby")).toBe(
      "store-import-attest-help",
    )
    expect(
      screen.getByText(/or I have the rights holder's permission to use it/),
    ).toBeDefined()
    expect(
      screen.getByText(
        /Importing someone else's listing without their permission, such as a competitor's product page, is not allowed/,
      ),
    ).toBeDefined()
    // The store wording is not on this screen at all.
    expect(screen.queryByText(/I own this store/)).toBeNull()
  })

  it("refuses to read the product until the merchant attests it", async () => {
    openProductStep()
    typeUrl(PRODUCT_URL)
    fireEvent.click(screen.getByRole("button", { name: "Read the product" }))

    await screen.findByText(
      "Confirm that this product's content is yours, or that you have the rights holder's permission, before importing it.",
    )
    expect(createStoreImport).not.toHaveBeenCalled()
  })

  it("refuses a store's home page as a product address", async () => {
    openProductStep()
    typeUrl("old-store.com")
    fireEvent.click(screen.getByRole("checkbox", { name: /content is mine/ }))
    fireEvent.click(screen.getByRole("button", { name: "Read the product" }))

    await screen.findByText(
      "That is a store's home page. Paste the address of the product's own page.",
    )
    expect(createStoreImport).not.toHaveBeenCalled()
  })

  it("sends scope PRODUCT and hands over to the progress route", async () => {
    openProductStep()
    typeUrl(PRODUCT_URL)
    fireEvent.click(screen.getByRole("checkbox", { name: /content is mine/ }))
    fireEvent.click(screen.getByRole("button", { name: "Read the product" }))

    await waitFor(() => expect(createStoreImport).toHaveBeenCalled())
    expect(createStoreImport).toHaveBeenCalledWith({
      variables: {
        input: {
          source_url: PRODUCT_URL,
          requested_platform: "AUTO",
          attested_owner: true,
          scope: "PRODUCT",
        },
      },
    })
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/store/acme/products/import/job_7"),
    )
  })

  it("does not carry a store attestation over to a product", () => {
    render(<ImportProductsDialog open onOpenChange={() => {}} />)
    fireEvent.click(
      screen.getByRole("radio", { name: /Import from your old online store/ }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("checkbox", { name: /I own this store/ }))

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    fireEvent.click(
      screen.getByRole("radio", { name: /Import a single product/ }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    const box = screen.getByRole("checkbox", { name: /content is mine/ })
    expect(box.getAttribute("aria-checked")).toBe("false")
  })
})
