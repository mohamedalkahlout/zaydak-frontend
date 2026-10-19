import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { FileEntry } from "@/features/files/types"

/**
 * The file view route replaced a full-screen overlay that the list owned in
 * `useState`. Moving it to a URL is what earns these tests: an overlay could
 * only ever be opened with a file the list was already showing, whereas a route
 * can be opened with any id at all — a stale bookmark, a deleted file, another
 * shop's id (the backend scopes the read, so that arrives as "missing"), or a
 * PDF someone typed by hand. Each branch below is one of those.
 *
 * Boundaries (Apollo, the router, the editor itself) are mocked per the repo's
 * component-test convention; what is asserted is this component's own job —
 * resolving its subject from the URL and choosing what to render for it.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const push = vi.fn()
const replace = vi.fn()
let params: Record<string, string> = {}
let search = ""
let queryResult: { data: unknown } = { data: null }

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => params,
  useSearchParams: () => new URLSearchParams(search),
}))

vi.mock("@apollo/client/react", () => ({
  useSuspenseQuery: () => ({ ...queryResult, refetch: vi.fn() }),
}))

// `FileViewUnavailable` renders inline here (it is the whole point of the
// unhappy-path cases below) and is localized, so the namespace has to resolve.
// Echoing the key keeps the assertions keyed on the key rather than on English
// copy, matching the convention in the other component tests.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  useLocale: () => "en",
}))

// The editor is a canvas host; here it only has to prove what it was handed.
vi.mock("../files-image-editor", () => ({
  FilesImageEditor: ({
    file,
    view,
    onViewChange,
    onClose,
  }: {
    file: FileEntry
    view: string
    onViewChange: (v: "edit" | "ai") => void
    onClose: () => void
  }) => (
    <div>
      <span data-testid="editor-file">{file.id}</span>
      <span data-testid="editor-view">{view}</span>
      <button onClick={() => onViewChange("ai")}>to-ai</button>
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

const { FileViewPage } = await import("../file-view-page")

function file(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: "att-1",
    filename: "abc.jpg",
    original_name: "images (3).jpg",
    mime_type: "image/jpeg",
    size: 1024,
    url: "https://cdn.test/abc.jpg",
    thumbnail: null,
    alt: null,
    context: "general",
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
    ...overrides,
  }
}

const pdf = () => ({
  data: {
    attachment: {
      success: true,
      data: file({ mime_type: "application/pdf", original_name: "spec.pdf" }),
    },
  },
})

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
  params = { shopSlug: "ahmed-electronics", fileId: "att-1" }
  search = ""
  queryResult = { data: { attachment: { success: true, data: file() } } }
})

describe("FileViewPage", () => {
  it("renders the editor for the file named in the path", () => {
    render(<FileViewPage />)

    expect(screen.getByTestId("editor-file").textContent).toBe("att-1")
    expect(screen.getByTestId("editor-view").textContent).toBe("edit")
  })

  it("opens on AI Studio when the URL asks for it", () => {
    search = "tab=ai"

    render(<FileViewPage />)

    expect(screen.getByTestId("editor-view").textContent).toBe("ai")
  })

  it("mirrors a workspace switch onto the URL without navigating", () => {
    const replaceState = vi.spyOn(window.history, "replaceState")
    render(<FileViewPage />)

    fireEvent.click(screen.getByText("to-ai"))

    // A router push here would re-render the segment on the server and could
    // remount the editor mid-run; the URL still has to end up correct.
    expect(push).not.toHaveBeenCalled()
    expect(replaceState.mock.calls[0][2]).toBe(
      "/store/ahmed-electronics/content/files/att-1?tab=ai",
    )
    replaceState.mockRestore()
  })

  it("closes back to the list, keeping the filters it arrived with", () => {
    search = "page=2&search=nike&tab=ai"

    render(<FileViewPage />)
    fireEvent.click(screen.getByText("close"))

    // `tab` belongs to the view, not the list, so it must not survive.
    expect(push).toHaveBeenCalledWith(
      "/store/ahmed-electronics/content/files?page=2&search=nike",
    )
  })

  it("explains a missing file instead of mounting an editor with nothing", () => {
    queryResult = { data: { attachment: { success: false, data: null } } }

    render(<FileViewPage />)

    expect(screen.queryByTestId("editor-file")).toBe(null)
    expect(screen.getByText("unavailable.notFound")).toBeTruthy()
  })

  it("survives a query that errored out entirely", () => {
    // errorPolicy 'all' hands back an empty result rather than throwing.
    queryResult = { data: undefined }

    render(<FileViewPage />)

    expect(screen.getByText("unavailable.notFound")).toBeTruthy()
  })

  it("sends a non-image on to its detail sheet instead of dead-ending", () => {
    queryResult = pdf()

    render(<FileViewPage />)

    expect(screen.queryByTestId("editor-file")).toBe(null)
    // The explanation still paints for the frame the redirect is in flight, so
    // a slow navigation never shows a blank screen.
    expect(screen.getByText("unavailable.notImage")).toBeTruthy()
    expect(screen.getByText("spec.pdf")).toBeTruthy()
    // replace, not push: Back should return to wherever the vendor came from,
    // never to a screen whose whole job is to leave.
    expect(replace).toHaveBeenCalledWith(
      "/store/ahmed-electronics/content/files?file=att-1",
    )
    expect(push).not.toHaveBeenCalled()
  })

  it("carries the list filters through that hand-off and drops the view's tab", () => {
    search = "page=2&search=nike&tab=ai"
    queryResult = pdf()

    render(<FileViewPage />)

    const href = replace.mock.calls[0][0] as string
    const query = new URLSearchParams(href.split("?")[1])
    expect(href.startsWith("/store/ahmed-electronics/content/files?")).toBe(true)
    expect(query.get("file")).toBe("att-1")
    expect(query.get("page")).toBe("2")
    expect(query.get("search")).toBe("nike")
    expect(query.get("tab")).toBe(null)
  })

  it("never redirects an image — the editor is its home", () => {
    render(<FileViewPage />)

    expect(screen.getByTestId("editor-file").textContent).toBe("att-1")
    expect(replace).not.toHaveBeenCalled()
  })

  it("leaves a missing file where it is — there is nothing to send it to", () => {
    queryResult = { data: { attachment: { success: false, data: null } } }

    render(<FileViewPage />)

    expect(screen.getByText("unavailable.notFound")).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })
})
