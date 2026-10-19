import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { DEFAULT_HOME_LAYOUT } from "../../lib/default-home-layout"
import { useThemeEditorStore } from "../../state/theme-editor-store"

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  Element.prototype.scrollIntoView = vi.fn()
})

function resetStore() {
  useThemeEditorStore.setState({
    shopSlug: "acme",
    layout: structuredClone(DEFAULT_HOME_LAYOUT),
    savedLayout: structuredClone(DEFAULT_HOME_LAYOUT),
    selectedSectionId: "sec_hero_01",
    previewDevice: "desktop",
    inspectorTab: "section",
    surface: "preview",
    history: [],
    future: [],
    loading: false,
    saving: false,
    publishing: false,
    ready: true,
  })
}

const { SectionTree } = await import("../section-tree")
const { SectionInspector } = await import("../section-inspector")
const { AddSectionDialog } = await import("../add-section-dialog")
const { EditorHeader } = await import("../editor-header")
const { MockThemePreview } = await import("../preview/mock-theme-preview")
const { CollectionChips } = await import("../collection-picker")

describe("theme editor UI", () => {
  beforeEach(() => {
    resetStore()
  })

  it("selects a section from the tree and shows its inspector", () => {
    render(
      <>
        <SectionTree />
        <SectionInspector />
      </>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Popular products" }))
    expect(useThemeEditorStore.getState().selectedSectionId).toBe(
      "sec_popular_01",
    )
    expect(screen.getByText("Source")).toBeDefined()
  })

  it("patches inspector settings into the store", () => {
    render(<SectionInspector />)
    fireEvent.click(screen.getByRole("checkbox", { name: "Show store statistics" }))
    expect(
      useThemeEditorStore.getState().layout.sections.sec_hero_01.settings
        .showStats,
    ).toBe(false)
  })

  it("adds a product rail from the add-section dialog", () => {
    render(<AddSectionDialog open onOpenChange={() => undefined} />)
    expect(screen.queryByRole("button", { name: "Hero" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Product rail" }))
    const { layout, selectedSectionId } = useThemeEditorStore.getState()
    expect(layout.sections[selectedSectionId!]?.type).toBe("product_rail")
    expect(layout.order.at(-1)).toBe(selectedSectionId)
  })

  it("switches the preview device", () => {
    render(<EditorHeader onExit={() => undefined} />)
    fireEvent.click(screen.getByRole("button", { name: "Tablet" }))
    expect(useThemeEditorStore.getState().previewDevice).toBe("tablet")
  })

  it("keeps a hidden section visible as an editor placeholder", () => {
    useThemeEditorStore.getState().toggleSection("sec_popular_01")
    render(<MockThemePreview />)
    const hidden = screen.getByText("Hidden from storefront")
    expect(hidden).toBeDefined()
    expect(
      within(hidden.closest("section") as HTMLElement).getByText(
        "Popular products",
      ),
    ).toBeDefined()
  })

  it("confirms a mock collection pick", () => {
    const onChange = vi.fn()
    render(<CollectionChips ids={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Select collections" }))
    fireEvent.click(screen.getByRole("button", { name: "Summer Collection" }))
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(onChange).toHaveBeenCalledWith(["col_summer"])
  })
})
