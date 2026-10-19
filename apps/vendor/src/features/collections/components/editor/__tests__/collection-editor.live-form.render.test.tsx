import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import {
  stashPrefill,
  useVendorAgentPrefillStore,
} from "@/features/ai/store-prefill"
import { useLiveFormStore } from "@/features/ai/store-live-form"
import {
  applyFormPatchFromResult,
  currentLiveForm,
} from "@/features/ai/lib/live-form"
import type { CollectionFormApi } from "@/features/collections/validations/shop-collection"

/**
 * The collection create form as the live form, on the real editor.
 *
 * The editor owns the form, the handoff read and the registration; the cards
 * under it draw the cover, the conditions and the product list, none of which
 * the assistant reads or writes. So the cards are stubbed down to the two
 * title inputs, registered on the editor's real form, and what is pinned is
 * the editor's own decisions: when it registers, what it reports, and that a
 * one-language patch leaves the other language alone.
 *
 * (No jest-dom in this project: plain DOM assertions.)
 */

const mockMutate = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [mockMutate, { loading: false }],
}))

vi.mock("@/features/products/components/form/ui/lang-tabs", () => ({
  LangTabsBar: () => null,
  LocaleProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("../details-card", async () => {
  const { AiFilledMark } = await import("@/features/ai/components/ai-filled-mark")
  return {
    DetailsCard: ({ form }: { form: CollectionFormApi }) => (
      <>
        <AiFilledMark name="name" />
        <AiFilledMark name="slug" />
        <input aria-label="title-en" {...form.register("name.en")} />
        <input aria-label="title-ar" {...form.register("name.ar")} />
        <input aria-label="handle" {...form.register("slug")} />
      </>
    ),
  }
})
vi.mock("../collection-page-header", () => ({
  CollectionPageHeader: () => null,
}))
vi.mock("../items-card", () => ({ ItemsCard: () => null }))
vi.mock("../seo-card", () => ({ SeoCard: () => null }))
vi.mock("../sources-panel", () => ({ SourcesPanel: () => null }))
vi.mock("../product-picker-dialog", () => ({ ProductPickerDialog: () => null }))

const { CollectionEditor } = await import("../collection-editor")

const input = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement

const patch = (formId: string, values: object) => ({
  ok: true,
  form_patch: {
    patch_id: "patch-1",
    form_id: formId,
    target: "collection_create",
    values,
    changed: [],
  },
})

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  useUnsavedBarStore.getState().hide()
  useVendorAgentPrefillStore.setState({ pending: {} })
  useLiveFormStore.setState({ current: null, outcomes: {} })
  sessionStorage.clear()
})

describe("<CollectionEditor /> as the live form", () => {
  it("registers under the handoff it was opened from", () => {
    const handoffId = stashPrefill({
      target: "collection_create",
      values: { name: { en: "Summer Sale" }, slug: "summer-sale" },
    })
    render(<CollectionEditor />)

    expect(useLiveFormStore.getState().current).toMatchObject({
      formId: handoffId,
      target: "collection_create",
    })
    // What the chat would send with the next message.
    expect(currentLiveForm()?.values).toEqual({
      name: { en: "Summer Sale" },
      slug: "summer-sale",
    })
    expect(screen.getAllByText("Filled by Sidekick")).toHaveLength(2)
  })

  it("does not register a form the vendor opened themselves", () => {
    render(<CollectionEditor />)

    expect(useLiveFormStore.getState().current).toBeNull()
    expect(screen.queryByText("Filled by Sidekick")).toBeNull()
  })

  it("does not register inside the product form's drawer", () => {
    // The live slot there belongs to the form around it: registering would
    // take the product form off the channel for as long as the drawer is up.
    stashPrefill({
      target: "collection_create",
      values: { name: { en: "Summer Sale" } },
    })
    render(
      <CollectionEditor
        embedded={{ header: () => null, onCreated: vi.fn() }}
      />,
    )

    expect(useLiveFormStore.getState().current).toBeNull()
    expect(screen.queryByText("Filled by Sidekick")).toBeNull()
  })

  it("stages a one-language rename and leaves the other language alone", () => {
    const handoffId = stashPrefill({
      target: "collection_create",
      values: { name: { en: "Summer Sale", ar: "تخفيضات الصيف" } },
    })
    render(<CollectionEditor />)
    expect(input("title-en").value).toBe("Summer Sale")

    let outcome: string | null = null
    act(() => {
      outcome = applyFormPatchFromResult(
        patch(handoffId, { name: { ar: "عروض الصيف" }, slug: "summer-2026" }),
      )
    })

    expect(outcome).toBe("applied")
    expect(input("title-ar").value).toBe("عروض الصيف")
    expect(input("title-en").value).toBe("Summer Sale")
    expect(input("handle").value).toBe("summer-2026")
    // Staged, never saved: the bar is up and no mutation has run.
    expect(useUnsavedBarStore.getState().active).toBe(true)
    expect(mockMutate).not.toHaveBeenCalled()
    // And the ticket holds the whole pair, so a reload reopens both.
    expect(
      useVendorAgentPrefillStore.getState().pending.collection_create?.values
        .name,
    ).toEqual({ en: "Summer Sale", ar: "عروض الصيف" })
  })
})
