import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { FileEntry } from "@/features/files/types"

/**
 * The detail sheet used to be opened only by a click on a row the list was
 * already showing, so `file` was never null while `open` and a close always
 * went through the sheet's own X. Moving "which file" onto the URL (`?file=`)
 * created three states an overlay never had: a subject still being resolved
 * by id, one that resolved to nothing, and a close made by the browser's Back
 * button — which never runs `handleClose`, so the draft it drops must not
 * resurface on the next open of the same id. Each of those is a case below,
 * beside the seeding and dirty-tracking the sheet always did.
 *
 * base-ui's Dialog portals and animates; neither is under test. A stand-in
 * that renders its children only while open, and exposes the close path,
 * keeps the assertions on this component's own job.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const show = vi.fn()
const hide = vi.fn()
const setError = vi.fn()

// Selector-aware: the component subscribes to one action at a time.
vi.mock("@/shared/stores/unsaved-bar", () => ({
  useUnsavedBarStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ show, hide, setError }),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: undefined, loading: false }),
  useMutation: () => [vi.fn()],
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@repo/ui/components/sheet", () => ({
  Sheet: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) =>
    open ? (
      <div data-testid="sheet">
        <button onClick={() => onOpenChange(false)}>close-sheet</button>
        {children}
      </div>
    ) : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}))

vi.mock("../file-preview", () => ({
  FilePreview: () => <div data-testid="preview" />,
}))

const { FileDetailSheet } = await import("../file-detail-sheet")

function file(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: "att-1",
    filename: "abc.pdf",
    original_name: "spec.pdf",
    mime_type: "application/pdf",
    size: 1024,
    url: "https://cdn.test/abc.pdf",
    thumbnail: null,
    alt: "the spec",
    context: "general",
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
    ...overrides,
  }
}

const noop = () => {}

function nameInput(): HTMLInputElement {
  return document.getElementById("file-name") as HTMLInputElement
}

beforeEach(() => {
  show.mockClear()
  hide.mockClear()
  setError.mockClear()
})

describe("FileDetailSheet", () => {
  it("seeds the staged name and alt from the file", () => {
    render(
      <FileDetailSheet
        file={file()}
        open
        onOpenChange={noop}
        onChanged={noop}
        onDeleted={noop}
      />,
    )

    expect(nameInput().value).toBe("spec.pdf")
    expect(
      (document.getElementById("file-alt") as HTMLTextAreaElement).value,
    ).toBe("the spec")
    expect(screen.queryByText("unavailable.notFound")).toBe(null)
  })

  it("explains a subject that resolved to nothing", () => {
    // A deleted file, or another shop's id — the backend scopes the read, so
    // both arrive as null. Before `?file=` this frame could not be reached.
    render(
      <FileDetailSheet
        file={null}
        open
        loading={false}
        onOpenChange={noop}
        onChanged={noop}
        onDeleted={noop}
      />,
    )

    expect(screen.getByText("unavailable.fallbackName")).toBeTruthy()
    expect(screen.getByText("unavailable.notFound")).toBeTruthy()
    expect(screen.getByText("unavailable.notFoundHint")).toBeTruthy()
    expect(nameInput()).toBe(null)
  })

  it("waits rather than declaring not-found while the subject is loading", () => {
    render(
      <FileDetailSheet
        file={null}
        open
        loading
        onOpenChange={noop}
        onChanged={noop}
        onDeleted={noop}
      />,
    )

    expect(screen.queryByText("unavailable.notFound")).toBe(null)
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
  })

  it("registers the save bar while dirty and drops it when the edit is reverted", () => {
    render(
      <FileDetailSheet
        file={file()}
        open
        onOpenChange={noop}
        onChanged={noop}
        onDeleted={noop}
      />,
    )

    fireEvent.change(nameInput(), { target: { value: "renamed.pdf" } })
    expect(show).toHaveBeenCalled()
    expect(show.mock.calls.at(-1)?.[0]).toMatchObject({
      label: "detail.unsavedChanges",
    })

    // Dirty is value-based: retyping the original collapses the bar.
    hide.mockClear()
    fireEvent.change(nameInput(), { target: { value: "spec.pdf" } })
    expect(hide).toHaveBeenCalled()
  })

  it("closes through onOpenChange, discarding the draft", () => {
    const onOpenChange = vi.fn()
    render(
      <FileDetailSheet
        file={file()}
        open
        onOpenChange={onOpenChange}
        onChanged={noop}
        onDeleted={noop}
      />,
    )

    fireEvent.change(nameInput(), { target: { value: "renamed.pdf" } })
    fireEvent.click(screen.getByText("close-sheet"))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    // handleDiscard clears the bar's error along with the draft.
    expect(setError).toHaveBeenCalledWith(null)
  })

  it("re-seeds from the server row after a close that bypassed discard", () => {
    // The browser's Back button closes the sheet by clearing `?file=`; nothing
    // in the sheet runs. Without the reset-on-close the seed key would still
    // name this id, so re-opening it would show the dropped draft again.
    const subject = file()
    const props = { onOpenChange: noop, onChanged: noop, onDeleted: noop }
    const { rerender } = render(
      <FileDetailSheet file={subject} open {...props} />,
    )

    fireEvent.change(nameInput(), { target: { value: "renamed.pdf" } })
    expect(nameInput().value).toBe("renamed.pdf")

    rerender(<FileDetailSheet file={null} open={false} {...props} />)
    expect(screen.queryByTestId("sheet")).toBe(null)

    rerender(<FileDetailSheet file={subject} open {...props} />)
    expect(nameInput().value).toBe("spec.pdf")
  })
})
