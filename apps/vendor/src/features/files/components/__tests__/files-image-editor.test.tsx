import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { FileEntry } from "@/features/files/types"

const { promote, deleteFile, replaceFile, reset, toast, cache, fetchMock } = vi.hoisted(() => ({
  promote: vi.fn(),
  deleteFile: vi.fn(),
  replaceFile: vi.fn(),
  reset: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  cache: { evict: vi.fn(), identify: vi.fn(() => "AttachmentEntry:original") },
  fetchMock: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: (document: { definitions: { name?: { value: string } }[] }) => {
    const name = document.definitions[0]?.name?.value
    if (name === "ReplaceAttachmentFromExisting") return [promote]
    if (name === "DeleteAttachmentFile") return [deleteFile]
    return [vi.fn()]
  },
}))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sileo", () => ({ sileo: toast }))
vi.mock("@/shared/lib/upload/use-attachment-upload", () => ({
  useAttachmentUpload: () => ({ uploadFiles: vi.fn() }),
}))
vi.mock("@/features/files/lib/use-replace-file", () => ({
  useReplaceFile: () => ({ replaceFile }),
}))
vi.mock("@/features/files/lib/use-enhance-file", () => ({
  nodeKey: () => "enhance:original:0",
  useEnhanceFile: () => ({
    state: "done",
    reset,
    outcome: {
      sources: [],
      runs: [{
        shot: "enhance",
        sourceId: "original",
        generationId: "generation",
        status: "SUCCEEDED",
        result: { attachment_id: "enhanced", url: "https://cdn.test/enhanced.png" },
      }],
    },
  }),
}))
vi.mock("@/features/products/components/form/ui/image-editor", () => ({
  ImageEditor: ({ stageOverlay }: { stageOverlay: ReactNode }) => <div>{stageOverlay}</div>,
}))
vi.mock("../enhance-studio-controls", () => ({ EnhanceStudioControls: () => null }))
vi.mock("../enhance-canvas", () => ({
  EnhanceCanvas: ({ onReplace, busy }: { onReplace: () => void; busy: unknown }) => (
    <button onClick={onReplace} disabled={!!busy}>Replace original</button>
  ),
}))

const { FilesImageEditor } = await import("../files-image-editor")
const file: FileEntry = {
  id: "original", filename: "original.jpg", original_name: "Product.jpg",
  mime_type: "image/jpeg", size: 100, url: "https://cdn.test/original.jpg",
  context: "files", created_at: "2026-08-01", updated_at: "2026-08-01",
}

function setup() {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(<FilesImageEditor file={file} view="ai" onClose={onClose} onSaved={onSaved}
    onViewChange={vi.fn()} onOpenFile={vi.fn()} />)
  return { onClose, onSaved }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  promote.mockImplementation(async (options) => {
    const result = { data: { replaceAttachmentFromExisting: { success: true, data: { id: "enhanced" } } } }
    options.update(cache, result)
    return result
  })
})

describe("FilesImageEditor direct replacement", () => {
  it("replaces by attachment ids without fetching, uploading, or deleting the generated image", async () => {
    const { onClose, onSaved } = setup()
    expect(promote).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("Replace original"))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(promote).toHaveBeenCalledWith(expect.objectContaining({
      variables: { id: "original", replacementId: "enhanced" },
    }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(replaceFile).not.toHaveBeenCalled()
    expect(deleteFile).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(cache.evict).toHaveBeenCalledWith({ id: "ROOT_QUERY", fieldName: "attachments" })
    expect(reset).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalledWith({ title: "toast.replaced" })
  })

  it.each(["network", "declined"])("keeps the review open and retryable after a %s failure", async (kind) => {
    if (kind === "network") promote.mockRejectedValue(new Error("offline"))
    else promote.mockResolvedValue({ data: { replaceAttachmentFromExisting: { success: false } } })
    const { onClose } = setup()
    fireEvent.click(screen.getByText("Replace original"))
    await waitFor(() => expect(toast.error).toHaveBeenCalledOnce())
    expect(onClose).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
    expect((screen.getByText("Replace original") as HTMLButtonElement).disabled).toBe(false)
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it("disables replacement while the mutation is pending", async () => {
    let resolve: (value: unknown) => void = () => undefined
    promote.mockReturnValue(new Promise((done) => { resolve = done }))
    const { onClose } = setup()
    fireEvent.click(screen.getByText("Replace original"))
    fireEvent.click(screen.getByText("Replace original"))
    expect(promote).toHaveBeenCalledOnce()
    expect((screen.getByText("Replace original") as HTMLButtonElement).disabled).toBe(true)
    resolve({ data: { replaceAttachmentFromExisting: { success: true } } })
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
})
