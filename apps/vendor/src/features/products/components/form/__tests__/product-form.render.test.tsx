import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ProductForm } from "../product-form"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"
import {
  stashPrefill,
  useVendorAgentPrefillStore,
} from "@/features/ai/store-prefill"
import { useLiveFormStore } from "@/features/ai/store-live-form"
import {
  applyFormPatchFromResult,
  currentLiveForm,
} from "@/features/ai/lib/live-form"
import { sileo } from "sileo"
import { productFormDefaults } from "@/features/products/lib/form/form-defaults"
import {
  readProductDraft,
  writeProductDraft,
} from "@/features/products/lib/form/product-draft"

const mockPush = vi.fn()
const mockCreateProduct = vi.fn()
const mockUpdateProduct = vi.fn()
const mockSileoSuccess = vi.fn()
const mockSileoError = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, prefetch: vi.fn() }),
  useParams: () => ({ shopSlug: "acme" }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("sileo", () => ({
  sileo: {
    success: (...args: unknown[]) => mockSileoSuccess(...args),
    error: (...args: unknown[]) => mockSileoError(...args),
    info: vi.fn(),
  },
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const mockLocationsData = {
  inventoryLocations: {
    success: true,
    data: [{ id: "loc-1", name: "Main Warehouse", is_default: true, is_active: true }],
  },
  inventoryLevels: {
    success: true,
    data: [],
  },
}

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    refetchQueries: vi.fn().mockResolvedValue([]),
  }),
  useQuery: () => ({ data: null, loading: false }),
  useSuspenseQuery: () => ({ data: mockLocationsData }),
  useMutation: (doc: any) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "UpdateProduct") {
      return [mockUpdateProduct, { loading: false }]
    }
    return [mockCreateProduct, { loading: false }]
  },
}))

vi.mock("@/shared/components/app-image", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}))

vi.mock("../ui/media-manager", () => ({
  MediaManager: () => <div data-testid="media-manager" />,
}))

vi.mock("../pickers/system-category-picker", () => ({
  SystemCategoryPicker: () => <div data-testid="system-category-picker" />,
}))

vi.mock("@/features/product-relations", () => ({
  ProductRelationsCard: () => <div data-testid="product-relations-card" />,
}))

vi.mock("../form/use-product-neighbors", () => ({
  useProductNeighbors: () => ({ previous: undefined, next: undefined }),
}))

describe("<ProductForm /> render & form lifecycle", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    useLeaveGuardStore.setState({ guard: null, pending: null })
    useUnsavedBarStore.getState().hide()
    mockCreateProduct.mockResolvedValue({
      data: {
        createProduct: {
          success: true,
          data: { id: "prod-new", slug: "new-denim-jacket", name: { en: "Created Product" } },
        },
      },
    })
    mockUpdateProduct.mockResolvedValue({
      data: {
        updateProduct: {
          success: true,
          data: { id: "prod-1", slug: "updated-product", version: 1 },
        },
      },
    })
  })

  it("renders Add Product page in pristine state without unsaved bar", () => {
    render(<ProductForm mode="create" />)

    expect(screen.getByRole("heading", { level: 1, name: "Add product" })).toBeDefined()
    expect(useUnsavedBarStore.getState().active).toBe(false)
    expect(useLeaveGuardStore.getState().guard).toBeNull()

    const titleInput = screen.getByPlaceholderText("Short sleeve t-shirt")
    expect((titleInput as HTMLInputElement).value).toBe("")
  })

  it("renders Edit Product page with populated initial values", () => {
    render(
      <ProductForm
        mode="edit"
        productId="prod-1"
        slug="linen-shirt"
        initialValues={{
          name: { en: "Linen Shirt", ar: "قميص كتان" },
          product_type: "SIMPLE",
          sale_type: "FIXED_PRICE",
          price: 150,
          cost_per_item: 80,
          inventory_tracking: false,
          status: "PUBLISH",
        } as any}
      />,
    )

    expect(screen.getByRole("heading", { level: 1, name: "Linen Shirt" })).toBeDefined()
    const titleInput = screen.getByPlaceholderText("Short sleeve t-shirt")
    expect((titleInput as HTMLInputElement).value).toBe("Linen Shirt")

    const priceInput = screen.getAllByPlaceholderText("0.00")[0]!
    expect((priceInput as HTMLInputElement).value).toBe("150")
  })

  it("arms unsaved bar and leave guard when product title is modified", () => {
    render(<ProductForm mode="create" />)

    expect(useUnsavedBarStore.getState().active).toBe(false)

    const titleInput = screen.getByPlaceholderText("Short sleeve t-shirt")
    fireEvent.change(titleInput, { target: { value: "Organic Cotton Tee" } })

    expect(useUnsavedBarStore.getState().active).toBe(true)
    expect(useLeaveGuardStore.getState().guard).not.toBeNull()
  })

  it("triggers product submission when contextual save bar onSave is invoked", async () => {
    render(<ProductForm mode="create" />)

    const titleInput = screen.getByPlaceholderText("Short sleeve t-shirt")
    fireEvent.change(titleInput, { target: { value: "New Denim Jacket" } })

    const priceInput = screen.getAllByPlaceholderText("0.00")[0]!
    fireEvent.change(priceInput, { target: { value: "250" } })

    const saveBarState = useUnsavedBarStore.getState()
    expect(saveBarState.active).toBe(true)
    expect(saveBarState.onSave).toBeDefined()

    // Trigger save via the unsaved bar
    saveBarState.onSave?.()

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockSileoSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Product created",
        }),
      )
    })
  })

  it("surfaces server validation errors in save bar when mutation fails", async () => {
    mockCreateProduct.mockRejectedValueOnce(new Error("Database write collision"))

    render(<ProductForm mode="create" />)

    const titleInput = screen.getByPlaceholderText("Short sleeve t-shirt")
    fireEvent.change(titleInput, { target: { value: "Broken Product" } })

    const priceInput = screen.getAllByPlaceholderText("0.00")[0]!
    fireEvent.change(priceInput, { target: { value: "100" } })

    const saveBarState = useUnsavedBarStore.getState()
    saveBarState.onSave?.()

    await waitFor(() => {
      expect(useUnsavedBarStore.getState().error).toBe("Database write collision")
    })
  })
})

/**
 * The live form channel, on the real form. "لأ، خلي السعر 300" said in the
 * chat while the assistant's draft is open used to produce a second card that
 * could not reach this form — it never remounts for a URL it is already on.
 * Now the form registers itself while it is the assistant's, and a patch is
 * staged into it like the vendor's own typing: dirty, save bar up, nothing
 * saved.
 */
describe("<ProductForm /> as the live form", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    useLeaveGuardStore.setState({ guard: null, pending: null })
    useUnsavedBarStore.getState().hide()
    useVendorAgentPrefillStore.setState({ pending: {} })
    useLiveFormStore.setState({ current: null, outcomes: {} })
    sessionStorage.clear()
  })

  const marks = () => screen.queryAllByText("Filled by Sidekick")

  const patch = (formId: string, values: Record<string, unknown>) => ({
    ok: true,
    form_patch: {
      patch_id: "patch-1",
      form_id: formId,
      target: "product_create",
      values,
      changed: [],
    },
  })

  it("registers under the handoff it was opened from", () => {
    const handoffId = stashPrefill({
      target: "product_create",
      values: { name: { en: "Hoodie", ar: "" }, price: 200 },
    })
    render(<ProductForm mode="create" />)

    expect(useLiveFormStore.getState().current?.formId).toBe(handoffId)
    // What the chat would send with the next message.
    expect(currentLiveForm()?.values).toMatchObject({
      name: { en: "Hoodie" },
      price: 200,
    })
  })

  it("does not register a form the vendor opened themselves", () => {
    render(<ProductForm mode="create" />)

    expect(useLiveFormStore.getState().current).toBeNull()
    expect(currentLiveForm()).toBeUndefined()
  })

  it("stages a patch: the input changes, the save bar shows, the mark stays", () => {
    const handoffId = stashPrefill({
      target: "product_create",
      values: { name: { en: "Hoodie", ar: "" }, price: 200 },
    })
    render(<ProductForm mode="create" />)
    const priceInput = screen.getAllByPlaceholderText(
      "0.00",
    )[0] as HTMLInputElement
    expect(priceInput.value).toBe("200")
    // An untouched first prefill shows no bar (2026-09-16).
    expect(useUnsavedBarStore.getState().active).toBe(false)
    const marked = marks().length

    act(() => {
      applyFormPatchFromResult(patch(handoffId, { price: 300 }))
    })

    expect(priceInput.value).toBe("300")
    expect(useUnsavedBarStore.getState().active).toBe(true)
    expect(marks()).toHaveLength(marked)
    expect(mockCreateProduct).not.toHaveBeenCalled()
  })

  it("marks a field again once the assistant patches what the vendor typed", () => {
    const handoffId = stashPrefill({
      target: "product_create",
      values: { name: { en: "Hoodie", ar: "" }, price: 200 },
    })
    render(<ProductForm mode="create" />)
    const marked = marks().length
    const priceInput = screen.getAllByPlaceholderText("0.00")[0]!
    fireEvent.change(priceInput, { target: { value: "250" } })
    expect(marks()).toHaveLength(marked - 1)

    act(() => {
      applyFormPatchFromResult(patch(handoffId, { price: 300 }))
    })

    expect(marks()).toHaveLength(marked)
  })

  it("marks no Description when create_product proposed none", () => {
    // The prefill `create_product` sent before 2026-10-01, which turns
    // persisted then still carry: an empty description pair beside the name
    // and price. The empty editor holds exactly that pair.
    stashPrefill({
      target: "product_create",
      values: {
        name: { en: "", ar: "هودي" },
        description: { en: "", ar: "" },
        status: "DRAFT",
        product_type: "SIMPLE",
        sale_type: "FIXED_PRICE",
        is_digital: false,
        price: 200,
      },
    })
    render(<ProductForm mode="create" />)

    const label = (text: string) =>
      screen
        .getAllByText(text)
        .map((el) => el.closest("[data-slot=field-label]"))
        .find(Boolean)
    expect(label("Description")?.textContent).not.toContain(
      "Filled by Sidekick",
    )
    // What it did propose is still marked.
    expect(label("Title")?.textContent).toContain("Filled by Sidekick")
  })

  it("keeps the English title when the assistant renamed only the Arabic one", () => {
    // `update_product` used to send `{ en: "", ar: "…" }` and the form spread
    // its prefill one level deep, so the English title went blank. It now
    // sends only the locale it was given, merged over the row per locale.
    stashPrefill({
      target: "product_edit",
      entityId: "prod-1",
      values: { name: { ar: "قميص كتان جديد" } },
    })
    render(
      <ProductForm
        mode="edit"
        productId="prod-1"
        slug="linen-shirt"
        initialValues={{
          name: { en: "Linen Shirt", ar: "قميص كتان" },
          product_type: "SIMPLE",
          sale_type: "FIXED_PRICE",
          price: 150,
          status: "PUBLISH",
        } as any}
      />,
    )

    const titleInput = screen.getByPlaceholderText(
      "Short sleeve t-shirt",
    ) as HTMLInputElement
    expect(titleInput.value).toBe("Linen Shirt")
    // Still the assistant's work: the field holds exactly the pair it made.
    const title = screen
      .getAllByText("Title")
      .map((el) => el.closest("[data-slot=field-label]"))
      .find(Boolean)
    expect(title?.textContent).toContain("Filled by Sidekick")
  })
})

/** Everything a handoff leaves behind between two tests. */
function resetHandoffState() {
  cleanup()
  vi.clearAllMocks()
  useLeaveGuardStore.setState({ guard: null, pending: null })
  useUnsavedBarStore.getState().hide()
  useVendorAgentPrefillStore.setState({ pending: {} })
  useLiveFormStore.setState({ current: null, outcomes: {} })
  sessionStorage.clear()
}

/**
 * A create draft parked by a form the assistant opened ends with that
 * handoff's ticket. Such a form is dirty once the assistant patches it, so it
 * was parked like any hand edit — and came back as "Draft restored" on the
 * vendor's next manual "Add product", long after they had walked away from
 * it. The helper and the hook are pinned in their own files; this is the real
 * form deciding what to mount with.
 */
describe("<ProductForm /> and a draft the assistant's form parked", () => {
  beforeEach(resetHandoffState)

  const park = (handoffId?: string) =>
    writeProductDraft("acme", {
      kind: "SIMPLE",
      values: {
        ...productFormDefaults("SIMPLE"),
        name: { en: "Autumn Hoodie", ar: "" },
      },
      saved_at: Date.now(),
      ...(handoffId ? { handoff_id: handoffId } : {}),
    })

  const title = () =>
    (screen.getByPlaceholderText("Short sleeve t-shirt") as HTMLInputElement)
      .value

  it("drops it on a manual Add product once its ticket is gone", async () => {
    // Saved, or walked away from: nothing is pending for the create form.
    park("h-gone")
    render(<ProductForm mode="create" />)

    await waitFor(() => expect(readProductDraft("acme")).toBeNull())
    expect(title()).toBe("")
    // No "Draft restored" toast over an empty form, and nothing unsaved.
    expect(sileo.info).not.toHaveBeenCalled()
    expect(useUnsavedBarStore.getState().active).toBe(false)
  })

  it("still restores a draft the vendor started themselves", async () => {
    park()
    render(<ProductForm mode="create" />)

    await waitFor(() => expect(title()).toBe("Autumn Hoodie"))
    expect(readProductDraft("acme")).not.toBeNull()
    expect(sileo.info).toHaveBeenCalledTimes(1)
  })

  it("restores the assistant's draft on a reload, while its ticket is still there", async () => {
    // A reload runs no unmount, so nothing released the ticket. Only its
    // 15-minute TTL has passed, which is why the form did not take the
    // prefill — and the same sitting's work must still come back.
    useVendorAgentPrefillStore.setState({
      pending: {
        product_create: {
          target: "product_create",
          handoffId: "h-here",
          values: { name: { en: "First prefill", ar: "" } },
          expires_at: Date.now() - 1,
        },
      },
    })
    park("h-here")
    render(<ProductForm mode="create" />)

    await waitFor(() => expect(title()).toBe("Autumn Hoodie"))
    expect(readProductDraft("acme")).not.toBeNull()
  })
})

/**
 * What the chat's composer chip calls the form ("Editing: Linen Shirt" / "New
 * product"): the label the form registers with.
 */
describe("<ProductForm /> names itself for the composer chip", () => {
  beforeEach(resetHandoffState)

  it("registers an edit form under the product's saved title", () => {
    stashPrefill({
      target: "product_edit",
      entityId: "prod-1",
      values: { name: { en: "Renamed Shirt" } },
    })
    render(
      <ProductForm
        mode="edit"
        productId="prod-1"
        slug="linen-shirt"
        initialValues={{
          name: { en: "Linen Shirt", ar: "قميص كتان" },
          product_type: "SIMPLE",
          sale_type: "FIXED_PRICE",
          price: 150,
          status: "PUBLISH",
        } as any}
      />,
    )

    // The product's own title, not the rename waiting in the form unsaved.
    expect(useLiveFormStore.getState().current?.label).toBe("Linen Shirt")
  })

  it("registers a create form with no title", () => {
    stashPrefill({
      target: "product_create",
      values: { name: { en: "Hoodie", ar: "" } },
    })
    render(<ProductForm mode="create" />)

    expect(useLiveFormStore.getState().current?.target).toBe("product_create")
    expect(useLiveFormStore.getState().current?.label).toBeUndefined()
  })
})
