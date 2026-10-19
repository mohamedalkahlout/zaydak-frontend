import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

/**
 * The "Add collection" drawer opened from a product's collections picker. What
 * is worth pinning is the way out of it, not the form inside: while the drawer
 * is open the global save bar belongs to the host product form, so nothing but
 * this file is watching for a full collection being thrown away — and every
 * close path (the header's Discard, Escape, a backdrop press) has to reach the
 * same confirm, while the one close that is not a discard — a successful create
 * — has to skip it.
 *
 * The editor is stubbed: this is about the shell's decisions, and mounting the
 * real one would drag in Apollo, react-hook-form and the preview query.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

// The stub drops the namespace, so what renders is the bare key the component
// asked for: `header.discard` comes out as "discard", `discardDialog.title` as
// itself. That is what the assertions below match on.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

let lastEmbedded: {
  onCreated: (collection: unknown) => void
  onDirtyChange?: (dirty: boolean) => void
  onLoadingChange?: (loading: boolean) => void
  stickyTop?: string
  header: (api: { submit: () => void; loading: boolean }) => React.ReactNode
} | null = null

vi.mock("@/features/collections/components/editor/collection-editor", () => ({
  CollectionEditor: ({ embedded }: { embedded: typeof lastEmbedded }) => {
    lastEmbedded = embedded
    return (
      <div>
        {embedded?.header({ submit: vi.fn(), loading: false })}
        <button type="button" onClick={() => embedded?.onDirtyChange?.(true)}>
          Make dirty
        </button>
        <button type="button" onClick={() => embedded?.onLoadingChange?.(true)}>
          Start saving
        </button>
        <button
          type="button"
          onClick={() =>
            embedded?.onCreated({
              id: "c1",
              name: { en: "Summer" },
              slug: "summer",
            })
          }
        >
          Finish
        </button>
      </div>
    )
  },
}))

import { CollectionCreateDialog } from "../collection-create-dialog"

beforeAll(() => {
  // Base UI measures the popup on open; jsdom ships no ResizeObserver and
  // without one the drawer never mounts its content.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

beforeEach(() => {
  lastEmbedded = null
})

function setup() {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  render(
    <CollectionCreateDialog
      open
      onOpenChange={onOpenChange}
      onCreated={onCreated}
    />,
  )
  return { onOpenChange, onCreated }
}

const discardButton = () => screen.findByText("discard")
const makeDirty = async () =>
  fireEvent.click(await screen.findByText("Make dirty"))

describe("CollectionCreateDialog", () => {
  it("closes straight away when nothing has been typed", async () => {
    const { onOpenChange } = setup()

    fireEvent.click(await discardButton())

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(screen.queryByText("discardDialog.title")).toBeNull()
  })

  it("asks before throwing a dirty form away", async () => {
    const { onOpenChange } = setup()
    await makeDirty()

    fireEvent.click(await discardButton())

    expect(await screen.findByText("discardDialog.title")).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("closes once the confirm is confirmed", async () => {
    const { onOpenChange } = setup()
    await makeDirty()
    fireEvent.click(await discardButton())

    fireEvent.click(await screen.findByText("discardDialog.discard"))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("keeps the drawer when the confirm is dismissed", async () => {
    const { onOpenChange } = setup()
    await makeDirty()
    fireEvent.click(await discardButton())
    expect(await screen.findByText("discardDialog.title")).toBeTruthy()

    fireEvent.click(await screen.findByText("discardDialog.keepEditing"))

    await waitFor(() =>
      expect(screen.queryByText("discardDialog.title")).toBeNull(),
    )
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("routes Escape through the same confirm", async () => {
    const { onOpenChange } = setup()
    await makeDirty()

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })

    expect(await screen.findByText("discardDialog.title")).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("does not ask on a successful create, dirty or not", async () => {
    const { onOpenChange, onCreated } = setup()
    await makeDirty()

    fireEvent.click(await screen.findByText("Finish"))

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({ id: "c1", label: "Summer" }),
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.queryByText("discardDialog.title")).toBeNull()
  })

  it("blocks dismissal while create mutation is in flight", async () => {
    const { onOpenChange } = setup()
    await makeDirty()
    fireEvent.click(await screen.findByText("Start saving"))

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })

    expect(screen.queryByText("discardDialog.title")).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("hands the editor a sticky offset for the host's scroll container", async () => {
    setup()

    await waitFor(() => expect(lastEmbedded).not.toBeNull())
    expect(lastEmbedded?.stickyTop).toBeTruthy()
  })
})

