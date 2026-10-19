import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { FileEntry } from "@/features/files/types"

/**
 * The studio's three ways in — device, library, link — all have to end at the
 * same thing: an attachment id a run can be keyed on. What is worth testing is
 * where they *differ*, which is entirely in their failure modes: an upload
 * reports its own reason and must not be papered over, and a URL import can
 * succeed at the network level while still leaving us without an id.
 */

const uploadFiles = vi.fn()
const uploadFromUrl = vi.fn()
let uploadError: string | null = null

vi.mock("@/shared/lib/upload/use-attachment-upload", () => ({
  ACCEPTED_IMAGE_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/svg+xml",
  ],
  useAttachmentUpload: () => ({
    uploadFiles,
    uploading: false,
    progress: 0,
    error: uploadError,
  }),
}))

vi.mock("../use-upload-from-url", () => ({
  useUploadFromUrl: () => ({ uploadFromUrl, uploading: false }),
}))

// The hook words its own errors; they resolve against the real catalogue.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { useStudioSource, STUDIO_SOURCE_TYPES, isStudioSourceMime } =
  await import("../use-studio-source")

const png = () => new File(["x"], "shoe.png", { type: "image/png" })

beforeEach(() => {
  uploadFiles.mockReset()
  uploadFromUrl.mockReset()
  uploadError = null
})

describe("the studio's source allow-list", () => {
  // An SVG reaches the provider and fails there — after the run has been
  // started and the spend path entered. Refusing it at the picker is the only
  // place the vendor can still do something about it.
  it("excludes SVG, which the models cannot rasterize", () => {
    expect(STUDIO_SOURCE_TYPES).not.toContain("image/svg+xml")
    expect(isStudioSourceMime("image/svg+xml")).toBe(false)
    expect(isStudioSourceMime("image/png")).toBe(true)
  })
})

describe("useStudioSource", () => {
  it("yields an attachment id after a device upload", async () => {
    uploadFiles.mockResolvedValue([
      { id: "att-1", original: "https://cdn.test/a.png", name: "shoe.png" },
    ])
    const { result } = renderHook(() => useStudioSource())

    await act(async () => {
      await result.current.uploadFromDevice([png()])
    })

    expect(result.current.source).toEqual({
      id: "att-1",
      url: "https://cdn.test/a.png",
      name: "shoe.png",
    })
  })

  // A run takes one source, so a multi-file drop must not silently pick a
  // different image than the one whose upload the vendor watched.
  it("takes only the first image from a multi-file drop", async () => {
    uploadFiles.mockResolvedValue([
      { id: "att-1", original: "https://cdn.test/a.png", name: "a.png" },
    ])
    const { result } = renderHook(() => useStudioSource())

    await act(async () => {
      await result.current.uploadFromDevice([png(), png(), png()])
    })

    expect(uploadFiles.mock.calls[0][0]).toHaveLength(1)
  })

  it("keeps the uploader's own reason on a rejected file", async () => {
    uploadFiles.mockResolvedValue([])
    uploadError = "shoe.pdf: unsupported file type."
    const { result } = renderHook(() => useStudioSource())

    await act(async () => {
      await result.current.uploadFromDevice([png()])
    })

    expect(result.current.source).toBe(null)
    // Not replaced with something vaguer — "unsupported file type" is the
    // whole value of the message.
    expect(result.current.error).toBe("shoe.pdf: unsupported file type.")
  })

  it("takes a library file without uploading anything", () => {
    const { result } = renderHook(() => useStudioSource())

    act(() => {
      result.current.pickFromLibrary({
        id: "att-7",
        url: "https://cdn.test/x.jpg",
        original_name: "x.jpg",
      } as FileEntry)
    })

    expect(uploadFiles).not.toHaveBeenCalled()
    expect(result.current.source?.id).toBe("att-7")
  })

  it("yields an attachment id after a URL import", async () => {
    uploadFromUrl.mockResolvedValue({
      ok: true,
      file: { id: "att-3", original: "https://cdn.test/c.jpg" },
    })
    const { result } = renderHook(() => useStudioSource())

    await act(async () => {
      await result.current.importFromUrl("https://example.com/c.jpg")
    })

    expect(result.current.source?.id).toBe("att-3")
  })

  it("surfaces a rejected import rather than sitting silent", async () => {
    uploadFromUrl.mockResolvedValue({ ok: false, error: "Could not fetch." })
    const { result } = renderHook(() => useStudioSource())

    await act(async () => {
      await result.current.importFromUrl("https://example.com/c.jpg")
    })

    expect(result.current.source).toBe(null)
    expect(result.current.error).toBe("Could not fetch.")
  })

  // The bytes landed but we have no id to run on. Doing nothing would look
  // like a dead button; the file is really in the library, so say that.
  it("explains an import that succeeded without returning an id", async () => {
    uploadFromUrl.mockResolvedValue({ ok: true, file: undefined })
    const { result } = renderHook(() => useStudioSource())

    await act(async () => {
      await result.current.importFromUrl("https://example.com/c.jpg")
    })

    expect(result.current.source).toBe(null)
    expect(result.current.error).toContain("library")
  })

  it("clears back to no source", async () => {
    uploadFromUrl.mockResolvedValue({
      ok: true,
      file: { id: "att-3", original: "https://cdn.test/c.jpg" },
    })
    const { result } = renderHook(() => useStudioSource())

    await act(async () => {
      await result.current.importFromUrl("https://example.com/c.jpg")
    })
    act(() => result.current.clear())

    expect(result.current.source).toBe(null)
  })
})
