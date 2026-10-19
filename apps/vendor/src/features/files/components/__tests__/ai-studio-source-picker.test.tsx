import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { StudioSource } from "@/features/files/lib/use-studio-source"

/**
 * The Images section — the studio's only control before a source exists.
 *
 * The behaviour worth pinning down is where a careless implementation would
 * cost the vendor something: importing a link is a write (it puts a real file
 * in their library), so it must never happen as a side effect of moving focus,
 * and the file input must refuse formats the models cannot read rather than
 * letting them fail inside a paid run.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

// The library picker is a dialog over its own query; here it only has to exist.
vi.mock("../media-library-picker", () => ({
  MediaLibraryPicker: ({ open }: { open: boolean }) =>
    open ? <div data-testid="library-open" /> : null,
}))

const { AiStudioSourcePicker } = await import("../ai-studio-source-picker")

const onUploadFiles = vi.fn()
const onPickFromLibrary = vi.fn()
const onImportUrl = vi.fn()
const onClear = vi.fn()

function setup(source: StudioSource | null = null, busy = false) {
  return render(
    <AiStudioSourcePicker
      source={source}
      busy={busy}
      progress={0}
      error={null}
      onUploadFiles={onUploadFiles}
      onPickFromLibrary={onPickFromLibrary}
      onImportUrl={onImportUrl}
      onClear={onClear}
    />,
  )
}

beforeEach(() => {
  onUploadFiles.mockClear()
  onPickFromLibrary.mockClear()
  onImportUrl.mockClear()
  onClear.mockClear()
})

describe("AiStudioSourcePicker", () => {
  it("offers all three ways in", () => {
    setup()

    expect(screen.getByLabelText("source.uploadTitle")).toBeTruthy()
    expect(screen.getByLabelText("source.libraryTitle")).toBeTruthy()
    expect(screen.getByPlaceholderText("source.urlPlaceholder")).toBeTruthy()
  })

  // SVG is in the library's allow-list but not the studio's — the models can't
  // rasterize it, so the file dialog must not offer it in the first place.
  it("restricts the file dialog to formats a run can actually use", () => {
    const { container } = setup()

    const accept = container.querySelector("input[type=file]")?.getAttribute("accept")
    expect(accept).toContain("image/png")
    expect(accept).not.toContain("svg")
  })

  it("opens the library on the folder half of the add tile", () => {
    setup()

    fireEvent.click(screen.getByLabelText("source.libraryTitle"))

    expect(screen.getByTestId("library-open")).toBeTruthy()
  })

  it("imports a link only when asked, never on blur", () => {
    setup()
    const field = screen.getByPlaceholderText("source.urlPlaceholder")

    fireEvent.change(field, { target: { value: "https://example.com/a.jpg" } })
    fireEvent.blur(field)

    // Tabbing out of a field the vendor was still editing is not consent to
    // write a file into their library.
    expect(onImportUrl).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("source.import"))
    expect(onImportUrl).toHaveBeenCalledWith("https://example.com/a.jpg")
  })

  it("imports on Enter", () => {
    setup()
    const field = screen.getByPlaceholderText("source.urlPlaceholder")

    fireEvent.change(field, { target: { value: "https://example.com/a.jpg" } })
    fireEvent.keyDown(field, { key: "Enter" })

    expect(onImportUrl).toHaveBeenCalledWith("https://example.com/a.jpg")
  })

  it("shows the chosen source and lets it be taken back off", () => {
    setup({ id: "att-1", url: "https://cdn.test/a.jpg", name: "a.jpg" })

    expect(screen.getByAltText("a.jpg")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("source.remove"))
    expect(onClear).toHaveBeenCalled()
  })

  it("locks every input while a source is being fetched", () => {
    setup(null, true)

    expect(
      (screen.getByLabelText("source.uploadTitle") as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByPlaceholderText("source.urlPlaceholder") as HTMLInputElement)
        .disabled,
    ).toBe(true)
  })
})
