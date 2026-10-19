import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { useForm } from "react-hook-form"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// The edit screen's header carries two writes of its own, Duplicate and
// Delete, and one thing that is not a write at all, Share. What is worth
// pinning is the one decision in each: Duplicate asks first *only* when the
// form is dirty — a clean form stays one click, a dirty one is told the copy
// will not carry its edits — and Share puts the storefront URL on screen
// before anything is copied, so an unlisted product's link is something the
// vendor sees rather than something that silently landed on the clipboard.

import type {
  ProductFormApi,
  ProductFormInput,
} from "@/features/products/validations/product"

const push = vi.fn()
const duplicate = vi.fn()
const success = vi.fn()
const error = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn() }),
  useParams: () => ({ shopSlug: "acme" }),
  useSearchParams: () => new URLSearchParams("page=2"),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [duplicate, { loading: false }],
}))

// The header's copy is what this asserts on, so it translates for real
// against `en.json` rather than echoing keys back.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({
  sileo: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => error(...args),
  },
}))

// The arrows have their own test; here they only need to render.
vi.mock("../form/use-product-neighbors", () => ({
  useProductNeighbors: () => ({ previous: undefined, next: undefined }),
}))

// The module reads the storefront origin once at load, so the stub has to be
// in place before the import rather than in a `beforeEach`.
vi.stubEnv("NEXT_PUBLIC_STOREFRONT_URL", "https://shop.test")
const { ProductPageHeader } = await import("../form/product-page-header")

const VIEW_HREF = "https://shop.test/acme/products/mug"

beforeAll(() => {
  // Base UI positions its popups with floating-ui, which measures the anchor.
  // jsdom ships no ResizeObserver, and without one the popup never mounts.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

/**
 * A real form rather than a mocked `useFormState`: what the header must get
 * right is *value-based* dirtiness, and only the genuine article can tell a
 * changed field from one typed back to its saved value.
 */
function Harness({ defaults }: { defaults?: Partial<ProductFormInput> }) {
  const form = useForm<ProductFormInput>({
    defaultValues: {
      name: { en: "Mug", ar: "" },
      status: "PUBLISH",
      ...defaults,
    } as ProductFormInput,
  }) as unknown as ProductFormApi

  return (
    <>
      <ProductPageHeader form={form} productId="p-1" slug="mug" />
      <button
        type="button"
        onClick={() =>
          form.setValue(
            "name",
            { en: "Mug, renamed", ar: "" },
            { shouldDirty: true },
          )
        }
      >
        dirty the form
      </button>
      <button
        type="button"
        onClick={() =>
          form.setValue("name", { en: "Mug", ar: "" }, { shouldDirty: true })
        }
      >
        type it back
      </button>
    </>
  )
}

const openShare = () =>
  fireEvent.click(screen.getByRole("button", { name: "Share" }))

async function chooseDuplicate() {
  fireEvent.click(screen.getByRole("button", { name: "More actions" }))
  fireEvent.click(
    await screen.findByRole("menuitem", { name: /Duplicate product/ }),
  )
}

const confirmTitle = () => screen.queryByText("Duplicate without saving?")

beforeEach(() => {
  push.mockReset()
  duplicate.mockReset()
  success.mockReset()
  error.mockReset()
  duplicate.mockResolvedValue({
    data: {
      duplicateProduct: { success: true, data: { id: "p-2", slug: "mug-copy" } },
    },
  })
})

describe("ProductPageHeader — Share", () => {
  it("opens a popover showing the storefront URL and the share targets", async () => {
    render(<Harness />)
    openShare()

    const link = (await screen.findByLabelText(
      "Product link",
    )) as HTMLInputElement
    expect(link.value).toBe(VIEW_HREF)
    expect(link.readOnly).toBe(true)

    // The targets are anchors rendered through `Button`, which Base UI
    // labels `role="button"` — the same shape as the Preview link beside
    // them — so they are found as buttons and checked as links.
    const target = (name: string) =>
      screen.getByRole("button", { name }) as HTMLAnchorElement
    expect(target("WhatsApp").getAttribute("href")).toContain(
      encodeURIComponent(VIEW_HREF),
    )
    expect(target("X").getAttribute("href")).toContain("twitter.com/intent")
    expect(target("Facebook").getAttribute("href")).toContain("facebook.com")
    // Email opens in the current tab: a blank `_blank` tab would outlive the
    // mail client it launched.
    expect(target("Email").getAttribute("href")).toMatch(/^mailto:/)
    expect(target("Email").getAttribute("target")).toBeNull()
    expect(target("WhatsApp").getAttribute("target")).toBe("_blank")
  })

  it("copies the URL and toasts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })

    render(<Harness />)
    openShare()
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }))

    expect(writeText).toHaveBeenCalledWith(VIEW_HREF)
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Link copied", description: VIEW_HREF }),
      ),
    )
  })

  it("tells a draft its link goes nowhere yet, and says nothing to a live product", async () => {
    const draft = render(<Harness defaults={{ status: "DRAFT" }} />)
    openShare()
    expect(
      await screen.findByText("Drafts are not visible on your storefront."),
    ).toBeDefined()
    // Copy stays enabled: the vendor may want the link ready for launch.
    expect(
      (screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    draft.unmount()

    render(<Harness defaults={{ status: "PUBLISH" }} />)
    openShare()
    await screen.findByLabelText("Product link")
    expect(
      screen.queryByText("Drafts are not visible on your storefront."),
    ).toBeNull()
  })
})

describe("ProductPageHeader — Duplicate", () => {
  it("writes at once and leaves for the copy when the form is clean", async () => {
    render(<Harness />)
    await chooseDuplicate()

    await waitFor(() =>
      expect(duplicate).toHaveBeenCalledWith({ variables: { id: "p-1" } }),
    )
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/store/acme/products/mug-copy/edit"),
    )
    expect(confirmTitle()).toBeNull()
  })

  it("asks first instead of writing when the form is dirty", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "dirty the form" }))
    await chooseDuplicate()

    expect(await screen.findByText("Duplicate without saving?")).toBeDefined()
    expect(duplicate).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it("does not ask when a field was typed back to its saved value", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "dirty the form" }))
    fireEvent.click(screen.getByRole("button", { name: "type it back" }))
    await chooseDuplicate()

    await waitFor(() => expect(duplicate).toHaveBeenCalled())
    expect(confirmTitle()).toBeNull()
  })

  it("Duplicate anyway writes and leaves for the copy", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "dirty the form" }))
    await chooseDuplicate()
    fireEvent.click(
      await screen.findByRole("button", { name: "Duplicate anyway" }),
    )

    await waitFor(() =>
      expect(duplicate).toHaveBeenCalledWith({ variables: { id: "p-1" } }),
    )
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/store/acme/products/mug-copy/edit"),
    )
    await waitFor(() => expect(confirmTitle()).toBeNull())
  })

  it("Cancel closes the confirm and writes nothing", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "dirty the form" }))
    await chooseDuplicate()
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }))

    await waitFor(() => expect(confirmTitle()).toBeNull())
    expect(duplicate).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it("stays open when the write fails, so the vendor can retry or cancel", async () => {
    duplicate.mockRejectedValue(new Error("nope"))
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "dirty the form" }))
    await chooseDuplicate()
    fireEvent.click(
      await screen.findByRole("button", { name: "Duplicate anyway" }),
    )

    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(confirmTitle()).not.toBeNull()
    expect(push).not.toHaveBeenCalled()
  })

  it("renders a View reviews link in More actions pointing to product reviews", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "More actions" }))
    const link = await screen.findByRole("menuitem", { name: "View reviews" })
    expect(link.getAttribute("href")).toBe("/store/acme/reviews?product=p-1")
  })
})

