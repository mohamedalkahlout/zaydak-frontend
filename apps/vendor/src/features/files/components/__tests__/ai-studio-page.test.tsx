import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { StudioSource } from "@/features/files/lib/use-studio-source"

/**
 * The source-first AI Studio. Its whole job is the hand-off: it is reached with
 * no file, collects one, and then gets out of the way — the screen that runs
 * enhancements on a real attachment already exists at `?tab=ai`, and this route
 * exists so a vendor with an empty library never has to go the long way round.
 *
 * So what is asserted here is the hand-off contract: every source path leaves
 * by the same door, it replaces rather than pushes, it carries the list params
 * on, and nothing configurable is offered before there is a source to configure
 * a run against.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const replace = vi.fn()
let params: Record<string, string> = {}
let search = ""
let source: StudioSource | null = null

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useParams: () => params,
  useSearchParams: () => new URLSearchParams(search),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/features/files/lib/use-studio-source", () => ({
  useStudioSource: () => ({
    source,
    busy: false,
    progress: 0,
    error: null,
    uploadFromDevice: vi.fn(),
    pickFromLibrary: vi.fn(),
    importFromUrl: vi.fn(),
    clear: vi.fn(),
  }),
}))

vi.mock("../ai-studio-source-picker", () => ({
  AiStudioSourcePicker: () => <div data-testid="picker" />,
}))

// The rail queries the shot registry; here it only has to prove how it was
// rendered — inert until there is something to run on.
vi.mock("../enhance-studio-controls", () => ({
  EnhanceStudioControls: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="rail" data-disabled={String(!!disabled)} />
  ),
}))

const { AiStudioPage } = await import("../ai-studio-page")

beforeEach(() => {
  replace.mockClear()
  params = { shopSlug: "ahmed-electronics" }
  search = ""
  source = null
})

describe("AiStudioPage", () => {
  it("offers the source picker before anything else exists", () => {
    render(<AiStudioPage />)

    expect(screen.getByTestId("picker")).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  // Picks made here would be silently dropped by the hand-off, so the rail must
  // plainly wait rather than accept input it is going to forget.
  it("renders the run controls inert while there is no source", () => {
    render(<AiStudioPage />)

    expect(screen.getByTestId("rail").dataset.disabled).toBe("true")
  })

  it("hands off to the file view on AI Studio once a source exists", () => {
    source = { id: "att-9", url: "https://cdn.test/a.jpg", name: "a.jpg" }

    render(<AiStudioPage />)

    // replace, not push: the picker has done its job, and the back button
    // should reach the library rather than an empty studio.
    expect(replace).toHaveBeenCalledWith(
      "/store/ahmed-electronics/content/files/att-9?tab=ai",
    )
  })

  it("carries the list filters through the hand-off", () => {
    search = "page=2&search=nike&view=grid"
    source = { id: "att-9", url: "https://cdn.test/a.jpg", name: "a.jpg" }

    render(<AiStudioPage />)

    const href = replace.mock.calls[0][0] as string
    const query = new URLSearchParams(href.split("?")[1])
    expect(href.startsWith("/store/ahmed-electronics/content/files/att-9?")).toBe(
      true,
    )
    expect(query.get("page")).toBe("2")
    expect(query.get("search")).toBe("nike")
    expect(query.get("tab")).toBe("ai")
  })

  it("links back to the list it was opened from", () => {
    search = "page=2&search=nike"

    render(<AiStudioPage />)

    const back = screen.getByText("source.backToFiles").closest("a")
    expect(back?.getAttribute("href")).toBe(
      "/store/ahmed-electronics/content/files?page=2&search=nike",
    )
  })
})
