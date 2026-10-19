import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { FileEntry } from "@/features/files/types"

/**
 * The list page's one routing decision: what a click on a row does. An image
 * goes to the file view route; anything else opens the detail sheet — and the
 * sheet is `?file=<id>` on this route, not local state, so a PDF is linkable
 * and Back closes it. What is asserted is that contract: the URL each click
 * writes, how the open sheet is read back off the URL, that a deep link to a
 * file not on the page is resolved by id, and that closing clears the param
 * with `replace` while keeping the list's own filters.
 *
 * Every child surface is mocked to the props it is handed; the toolbar, grid,
 * upload path and bulk bar have their own concerns and are not exercised here.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const push = vi.fn()
const replace = vi.fn()
const refetch = vi.fn()
let search = ""
let rows: FileEntry[] = []
let byIdResult: { data: unknown; loading: boolean } = {
  data: undefined,
  loading: false,
}
const byIdCalls: Array<{ variables: { id: string }; skip: boolean }> = []

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/store/acme/content/files",
  useParams: () => ({ shopSlug: "acme" }),
  useSearchParams: () => new URLSearchParams(search),
}))

vi.mock("@apollo/client/react", () => ({
  useSuspenseQuery: () => ({
    data: {
      attachments: {
        success: true,
        data: rows,
        meta: { total: rows.length, page: 1, limit: 15, total_pages: 1 },
      },
    },
    refetch,
  }),
  useMutation: () => [vi.fn()],
  useQuery: (
    _query: unknown,
    options: { variables: { id: string }; skip: boolean },
  ) => {
    byIdCalls.push(options)
    return options.skip ? { data: undefined, loading: false } : byIdResult
  },
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/shared/lib/upload/use-attachment-upload", () => ({
  ACCEPTED_FILE_ATTR: "",
  ACCEPTED_FILE_TYPES: [],
  useAttachmentUpload: () => ({
    uploadFiles: vi.fn(),
    uploading: false,
    progress: 0,
    error: null,
  }),
}))

vi.mock("@/features/files/lib/use-replace-file", () => ({
  useReplaceFile: () => ({ replaceFile: vi.fn(), replacingId: null }),
}))

vi.mock("../files-header", () => ({ FilesHeader: () => null }))
vi.mock("../files-toolbar", () => ({ FilesToolbar: () => null }))
vi.mock("../files-bulk-bar", () => ({ FilesBulkBar: () => null }))
vi.mock("../files-grid", () => ({ FilesGrid: () => null }))
vi.mock("../files-empty", () => ({ FilesEmpty: () => null }))
vi.mock("../upload-from-url-dialog", () => ({
  UploadFromUrlDialog: () => null,
}))

// One button per row is all the list has to offer here — the click is the
// routing decision under test.
vi.mock("../files-list-view", () => ({
  FilesListView: ({
    files,
    onOpen,
  }: {
    files: FileEntry[]
    onOpen: (id: string) => void
  }) => (
    <div>
      {files.map((f) => (
        <button key={f.id} onClick={() => onOpen(f.id)}>
          open-{f.id}
        </button>
      ))}
    </div>
  ),
}))

// The sheet only has to prove what it was handed and offer the close path.
vi.mock("../file-detail-sheet", () => ({
  FileDetailSheet: ({
    file,
    open,
    loading,
    onOpenChange,
  }: {
    file: FileEntry | null
    open: boolean
    loading?: boolean
    onOpenChange: (open: boolean) => void
  }) => (
    <div
      data-testid="sheet"
      data-open={String(open)}
      data-file={file?.id ?? ""}
      data-loading={String(!!loading)}
    >
      <button onClick={() => onOpenChange(false)}>close-sheet</button>
    </div>
  ),
}))

const { FilesPage } = await import("../files-page")

function file(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: "att-1",
    filename: "abc.jpg",
    original_name: "photo.jpg",
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

const sheet = () => screen.getByTestId("sheet")

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
  refetch.mockClear()
  byIdCalls.length = 0
  search = ""
  byIdResult = { data: undefined, loading: false }
  rows = [
    file(),
    file({
      id: "att-2",
      filename: "spec.pdf",
      original_name: "spec.pdf",
      mime_type: "application/pdf",
      url: "https://cdn.test/spec.pdf",
    }),
  ]
})

describe("FilesPage", () => {
  it("opens a non-image through the URL, not local state", () => {
    render(<FilesPage />)

    fireEvent.click(screen.getByText("open-att-2"))

    // Push, so Back closes the sheet; scroll: false, so the list does not jump
    // to the top under the panel on a same-page query change.
    expect(push).toHaveBeenCalledWith("/store/acme/content/files?file=att-2", {
      scroll: false,
    })
    expect(sheet().dataset.open).toBe("false")
  })

  it("still sends an image to the editor route", () => {
    render(<FilesPage />)

    fireEvent.click(screen.getByText("open-att-1"))

    expect(push).toHaveBeenCalledWith("/store/acme/content/files/att-1")
  })

  it("keeps the list's filters on the sheet URL", () => {
    // List view on purpose: `view=grid` would render the (mocked) grid, and
    // the routes test already pins that `view` rides along too.
    search = "page=2&search=nike&types=pdf"

    render(<FilesPage />)
    fireEvent.click(screen.getByText("open-att-2"))

    const href = push.mock.calls[0][0] as string
    const query = new URLSearchParams(href.split("?")[1])
    expect(query.get("file")).toBe("att-2")
    expect(query.get("page")).toBe("2")
    expect(query.get("search")).toBe("nike")
    expect(query.getAll("types")).toEqual(["pdf"])
  })

  it("reads the open sheet off ?file= and hands it the row from the page", () => {
    search = "file=att-2"

    render(<FilesPage />)

    expect(sheet().dataset.open).toBe("true")
    expect(sheet().dataset.file).toBe("att-2")
    expect(sheet().dataset.loading).toBe("false")
    // The row is on this page, so no by-id read is spent on it.
    expect(byIdCalls.at(-1)?.skip).toBe(true)
  })

  it("resolves a deep link to a file that is not on the page by id", () => {
    search = "file=att-9"
    byIdResult = {
      data: {
        attachment: {
          success: true,
          data: file({ id: "att-9", mime_type: "video/mp4" }),
        },
      },
      loading: false,
    }

    render(<FilesPage />)

    expect(byIdCalls.at(-1)).toMatchObject({
      variables: { id: "att-9" },
      skip: false,
    })
    expect(sheet().dataset.open).toBe("true")
    expect(sheet().dataset.file).toBe("att-9")
  })

  it("tells the sheet it is loading while that by-id read is in flight", () => {
    search = "file=att-9"
    byIdResult = { data: undefined, loading: true }

    render(<FilesPage />)

    expect(sheet().dataset.open).toBe("true")
    expect(sheet().dataset.file).toBe("")
    expect(sheet().dataset.loading).toBe("true")
  })

  it("closes by clearing ?file= with replace, keeping the filters", () => {
    search = "page=2&search=nike&file=att-2"

    render(<FilesPage />)
    fireEvent.click(screen.getByText("close-sheet"))

    // Replace, not back: a deep-linked sheet has no list entry behind it, and
    // replace keeps Back from re-opening a sheet the vendor just dismissed.
    expect(replace).toHaveBeenCalledWith(
      "/store/acme/content/files?page=2&search=nike",
      { scroll: false },
    )
  })
})
