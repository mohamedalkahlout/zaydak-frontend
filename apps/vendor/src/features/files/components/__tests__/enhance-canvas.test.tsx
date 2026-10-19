import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { nodeKey, type ShotRun } from "@/features/files/lib/use-enhance-file"

/**
 * The canvas pulls in Apollo (the shot-name registry) and next-intl. Following
 * the repo's component-test convention (see `notifications-bell.test.tsx`), the
 * boundaries are mocked and the component's own behaviour is asserted: which
 * node state each run renders, that an arrow exists per shot, and that the
 * per-node actions are wired and gated.
 *
 * The states matter more than they look. The strip this replaced rendered a
 * *pending* shot as "Could not produce this shot" — result-or-error with no
 * third branch — so a run in flight showed as a failed run. The first three
 * cases below are that regression, pinned.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

// jsdom ships no ResizeObserver; the canvas measures its own stage with one.
// The stub never fires, which is the interesting case anyway — the opening fit
// is skipped and the viewport stays at its 100% identity.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", NoopResizeObserver)

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({
    data: {
      enhanceStyles: {
        shots: [
          { id: "enhance", name: "Enhance original" },
          { id: "social", name: "Social post" },
        ],
      },
    },
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  useLocale: () => "en",
}))

const { EnhanceCanvas } = await import("../enhance-canvas")

const result = (id: string) => ({
  id,
  attachment_id: `att-${id}`,
  url: `https://cdn.test/${id}.jpg`,
  thumbnail: null,
  selected: false,
})

/** The single source these tests run against, unless one names its own. */
const SOURCE = {
  id: "src-1",
  url: "https://cdn.test/source.jpg",
  original_name: "tub.jpg",
}

const pending = (shot: string, sourceId = SOURCE.id): ShotRun => ({
  shot,
  sourceId,
  generationId: `gen-${sourceId}-${shot}`,
  status: "RUNNING",
})
const succeeded = (shot: string, sourceId = SOURCE.id): ShotRun => ({
  shot,
  sourceId,
  generationId: `gen-${sourceId}-${shot}`,
  status: "SUCCEEDED",
  result: result(shot),
})
const failed = (
  shot: string,
  error: string,
  sourceId = SOURCE.id,
): ShotRun => ({
  shot,
  sourceId,
  generationId: `gen-${sourceId}-${shot}`,
  status: "FAILED",
  error,
})

const onReplace = vi.fn()
const onDone = vi.fn()
const onCancelRun = vi.fn()
const onUseAsSource = vi.fn()
const onRerunShot = vi.fn()
const onDiscardShot = vi.fn()

function setup(
  runs: ShotRun[],
  busy: "replace" | "discard" | null = null,
  sources = [SOURCE],
) {
  return render(
    <EnhanceCanvas
      runs={runs}
      sources={sources}
      // Targeted at the first node, which is what every busy-state test here
      // means by "an action is in flight". The prop is keyed per node now, so
      // the lock has to name one rather than being a bare flag.
      busy={busy ? { kind: busy, key: nodeKey(runs[0]!) } : null}
      onReplace={onReplace}
      onDone={onDone}
      onCancelRun={onCancelRun}
      onUseAsSource={onUseAsSource}
      onRerunShot={onRerunShot}
      onDiscardShot={onDiscardShot}
    />,
  )
}

beforeEach(() => {
  onReplace.mockClear()
  onDone.mockClear()
  onCancelRun.mockClear()
  onUseAsSource.mockClear()
  onRerunShot.mockClear()
  onDiscardShot.mockClear()
})

describe("EnhanceCanvas node states", () => {
  it("shows a pending shot as generating, not as a failure", () => {
    setup([pending("enhance")])
    expect(screen.getByText("canvas.generating")).toBeTruthy()
    expect(screen.queryByText(/shotFailed|enhanceFailed/)).toBeNull()
  })

  it("shows a failed shot's reason and keeps its node on the canvas", () => {
    setup([failed("social", "Blocked by the safety filter.")])
    expect(screen.getByText("Blocked by the safety filter.")).toBeTruthy()
    expect(screen.getByText("Social post")).toBeTruthy()
  })

  it("renders a mixed run as one image and one error, not one failure", () => {
    const { container } = setup([succeeded("enhance"), failed("social", "Timed out.")])
    expect(screen.getByText("Timed out.")).toBeTruthy()
    const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"))
    expect(srcs).toContain("https://cdn.test/enhance.jpg")
    expect(srcs).toContain("https://cdn.test/source.jpg")
  })

  it("keeps the source node whatever the run did", () => {
    const { container } = setup([failed("enhance", "x"), failed("social", "y")])
    expect(screen.getByText("canvas.source")).toBeTruthy()
    expect(
      container.querySelector('img[src="https://cdn.test/source.jpg"]'),
    ).toBeTruthy()
  })
})

/**
 * Stopping a run reclaims the shop's monthly quota slot for any shot that has
 * not landed (`getMonthlyUsage` excludes CANCELED rows), so the control has to
 * appear exactly while there is something to reclaim. Offering it on a settled
 * run would invite a click that spends attention and returns nothing; hiding it
 * during one strands the vendor on a stuck generation with no way out but a
 * page reload — which is the state that existed before, since
 * `cancelImageGeneration` had no call site at all.
 */
describe("EnhanceCanvas stop-run control", () => {
  it("offers Stop run while any shot is still pending", () => {
    setup([succeeded("enhance"), pending("social")])
    fireEvent.click(screen.getByText("canvas.cancelRun"))
    expect(onCancelRun).toHaveBeenCalledTimes(1)
  })

  it("hides Stop run once every shot is terminal", () => {
    setup([succeeded("enhance"), failed("social", "Timed out.")])
    expect(screen.queryByText("canvas.cancelRun")).toBeNull()
    expect(screen.getByText("done")).toBeTruthy()
  })

  it("does not offer Stop run for a run whose shots all failed", () => {
    // Every shot terminal, nothing to stop — Done is the only way out, and it
    // is what closes a review with no images in it.
    setup([failed("enhance", "x"), failed("social", "y")])
    expect(screen.queryByText("canvas.cancelRun")).toBeNull()
  })
})

/**
 * The two actions that let a result leave the canvas as something other than a
 * replacement: chained into another run, or saved to disk.
 *
 * Both are gated on a *successful* shot. A pending node has no URL yet and a
 * failed one never will, so offering either would be a button that cannot work
 * — and the discard action beside them already proves the gating is per-node
 * rather than per-run.
 */
describe("EnhanceCanvas result actions", () => {
  const actionOn = (label: string) =>
    screen.queryAllByLabelText(label)[0] as HTMLButtonElement | undefined

  it("hands the chained attachment id back, not the generation id", () => {
    setup([succeeded("social")])
    fireEvent.click(actionOn("canvas.useAsSource")!)
    expect(onUseAsSource).toHaveBeenCalledTimes(1)
    // The next run is keyed on an attachment; passing the generation id would
    // resolve to nothing and render FileViewUnavailable.
    expect(onUseAsSource.mock.calls[0][0].result.attachment_id).toBe(
      "att-social",
    )
  })

  it("offers both actions on the enhance shot too, beside Replace", () => {
    setup([succeeded("enhance")])
    expect(actionOn("canvas.useAsSource")).toBeTruthy()
    expect(actionOn("canvas.download")).toBeTruthy()
    expect(actionOn("replaceOriginal")).toBeTruthy()
  })

  it("offers neither on a pending or failed shot", () => {
    setup([pending("enhance"), failed("social", "Timed out.")])
    expect(actionOn("canvas.useAsSource")).toBeUndefined()
    expect(actionOn("canvas.download")).toBeUndefined()
  })

  // Node actions sit over the image inside a draggable node. Without the
  // stopPropagation the wrapper installs, pressing one would start a pan and
  // the click would never land.
  it("keeps node actions clickable rather than starting a drag", () => {
    setup([succeeded("social")])
    const action = actionOn("canvas.useAsSource")!
    fireEvent.pointerDown(action)
    fireEvent.click(action)
    expect(onUseAsSource).toHaveBeenCalledTimes(1)
  })
})

/**
 * Re-rolling one node.
 *
 * The important case is the **failed** one. A shot that timed out or was
 * filtered is the single most likely thing a vendor wants to try again, and
 * until now that card offered only "dismiss" — so the way to retry one shot was
 * to close the review and rebuild the entire run from the rail, which resets per
 * file. The retry therefore has to reach the failure card, not just the success
 * row.
 */
describe("EnhanceCanvas re-roll", () => {
  const actionOn = (label: string) =>
    screen.queryAllByLabelText(label)[0] as HTMLButtonElement | undefined

  it("retries a failed shot from its own card", () => {
    setup([failed("social", "Timed out.")])
    fireEvent.click(screen.getByText("canvas.rerun"))
    expect(onRerunShot).toHaveBeenCalledTimes(1)
    expect(onRerunShot.mock.calls[0][0].shot).toBe("social")
  })

  it("retries a successful shot from its action row", () => {
    setup([succeeded("enhance")])
    fireEvent.click(actionOn("canvas.rerun")!)
    expect(onRerunShot.mock.calls[0][0].shot).toBe("enhance")
  })

  it("keeps dismiss available beside the retry", () => {
    setup([failed("social", "Timed out.")])
    fireEvent.click(screen.getByText("canvas.dismiss"))
    expect(onDiscardShot).toHaveBeenCalledTimes(1)
    expect(onRerunShot).not.toHaveBeenCalled()
  })

  // One run at a time: the hook refuses a re-roll while polling, so a button
  // that looked live during a settling run would be a click that does nothing.
  it("is disabled while another shot is still settling", () => {
    setup([failed("social", "Timed out."), pending("enhance")])
    const retry = screen.getByText("canvas.rerun") as HTMLButtonElement
    expect(retry.disabled).toBe(true)
    fireEvent.click(retry)
    expect(onRerunShot).not.toHaveBeenCalled()
  })
})

describe("EnhanceCanvas edges", () => {
  it("draws one arrow per shot, from the source", () => {
    const { container } = setup([succeeded("enhance"), pending("social")])
    const paths = [...container.querySelectorAll("svg path[marker-end]")]
    expect(paths).toHaveLength(2)
    for (const p of paths) expect(p.getAttribute("d")?.startsWith("M ")).toBe(true)
  })

  it("dashes an unsettled edge and solidifies a finished one", () => {
    const { container } = setup([succeeded("enhance"), pending("social")])
    const [done, running] = [
      ...container.querySelectorAll("svg path[marker-end]"),
    ]
    expect(done!.getAttribute("stroke-dasharray")).toBeNull()
    expect(running!.getAttribute("stroke-dasharray")).toBe("7 7")
  })

  it("points every arrow at a marker that actually resolves", () => {
    // `useId` wraps its value in punctuation; an unstripped `:r0:` would make
    // `url(#:r0:-done)` a dangling reference and no arrowhead would render.
    const { container } = setup([succeeded("enhance")])
    const ref = container
      .querySelector("svg path[marker-end]")!
      .getAttribute("marker-end")!
    const id = ref.slice(5, -1)
    expect(id).toMatch(/^[A-Za-z][\w-]*$/)
    expect(container.querySelector(`#${id}`)).toBeTruthy()
  })
})

describe("EnhanceCanvas actions", () => {
  it("offers Compare and Replace on the enhanced original only", () => {
    setup([succeeded("enhance"), succeeded("social")])
    expect(screen.getAllByLabelText("canvas.compare")).toHaveLength(1)
    expect(screen.getAllByLabelText("replaceOriginal")).toHaveLength(1)
  })

  it("offers neither when the run produced no enhanced original", () => {
    setup([succeeded("social")])
    expect(screen.queryByLabelText("canvas.compare")).toBeNull()
    expect(screen.queryByLabelText("replaceOriginal")).toBeNull()
  })

  it("discards the shot whose node was clicked", () => {
    const runs = [succeeded("enhance"), succeeded("social")]
    setup(runs)
    fireEvent.click(
      screen.getByLabelText('discardShot:{"shot":"Social post"}'),
    )
    expect(onDiscardShot).toHaveBeenCalledWith(runs[1])
  })

  it("lets a failed node be dismissed even with nothing to delete", () => {
    const run = failed("social", "Timed out.")
    setup([run])
    fireEvent.click(screen.getByText("canvas.dismiss"))
    expect(onDiscardShot).toHaveBeenCalledWith(run)
  })

  it("locks every action while a replace or discard is in flight", () => {
    setup([succeeded("enhance")], "replace")
    for (const label of ["canvas.compare", "replaceOriginal"]) {
      expect(
        (screen.getByLabelText(label) as HTMLButtonElement).disabled,
      ).toBe(true)
    }
    expect((screen.getByText("done") as HTMLButtonElement).disabled).toBe(true)
  })

  it("keeps Done reachable while the run is still going", () => {
    setup([pending("enhance")])
    fireEvent.click(screen.getByText("done"))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it("opens the wipe overlay from the enhanced original's node", () => {
    setup([succeeded("enhance")])
    expect(screen.queryByLabelText("compare.sliderAria")).toBeNull()
    fireEvent.click(screen.getByLabelText("canvas.compare"))
    expect(screen.getByLabelText("compare.sliderAria")).toBeTruthy()
  })
})

describe("EnhanceCanvas viewport", () => {
  it("pins the graph subtree to LTR so the flow axis never mirrors", () => {
    const { container } = setup([succeeded("enhance")])
    expect(container.querySelector('[dir="ltr"]')).toBeTruthy()
  })

  it("zooms with the toolbar and reports the level", () => {
    setup([succeeded("enhance")])
    // jsdom reports a 0x0 stage, so the opening fit never runs and the
    // viewport stays at its 100% identity — which is what makes this readable.
    expect(screen.getByText("100%")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("canvas.zoomIn"))
    expect(screen.getByText("120%")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("canvas.zoomOut"))
    expect(screen.getByText("100%")).toBeTruthy()
  })
})

/**
 * A batch run — the library's selection enhanced with one set of settings.
 *
 * The canvas draws one cluster per source, and what these pin is that the
 * *association* survives: which output came from which photo, and that an action
 * on one node reaches only that node. Getting that wrong on a twenty-image run
 * means a vendor discarding the wrong image, which is the one mistake here that
 * destroys something.
 */
describe("EnhanceCanvas — batch", () => {
  const SOURCE_B = {
    id: "src-2",
    url: "https://cdn.test/second.jpg",
    original_name: "mug.jpg",
  }
  const batch = () => [
    succeeded("enhance", SOURCE.id),
    succeeded("enhance", SOURCE_B.id),
  ]

  it("draws one source node per source", () => {
    setup(batch(), null, [SOURCE, SOURCE_B])
    const sources = screen.getAllByRole("group", { name: "canvas.source" })
    expect(sources).toHaveLength(2)
  })

  it("names each source, so the clusters can be told apart", () => {
    setup(batch(), null, [SOURCE, SOURCE_B])
    // Only on a batch: with one source the name would repeat the file the
    // editor is already showing behind the canvas.
    expect(screen.queryByText("tub.jpg")).not.toBeNull()
    expect(screen.queryByText("mug.jpg")).not.toBeNull()
  })

  it("leaves the source unnamed on a single-image run", () => {
    setup([succeeded("enhance")])
    expect(screen.queryByText("tub.jpg")).toBeNull()
  })

  it("draws one arrow per output, not one per shot id", () => {
    // Both sources produce an `enhance`, so keying the arrows on the shot id
    // collapsed the two into one and left a cluster with no visible branch.
    const { container } = setup(batch(), null, [SOURCE, SOURCE_B])
    const edges = container.querySelectorAll("path[marker-end]")
    expect(edges).toHaveLength(2)
  })

  it("discards only the node that was clicked", () => {
    setup(batch(), null, [SOURCE, SOURCE_B])
    const discards = screen.getAllByLabelText(/^discardShot:/)
    expect(discards).toHaveLength(2)
    fireEvent.click(discards[1]!)
    expect(onDiscardShot).toHaveBeenCalledTimes(1)
    // The second source's output, not the first's — the run objects differ only
    // by `sourceId`, which is exactly what a shot-keyed handler would lose.
    expect(onDiscardShot.mock.calls[0][0].sourceId).toBe(SOURCE_B.id)
  })

  it("re-rolls only the node that was clicked", () => {
    setup(batch(), null, [SOURCE, SOURCE_B])
    const retries = screen.getAllByLabelText("canvas.rerun")
    expect(retries).toHaveLength(2)
    fireEvent.click(retries[1]!)
    expect(onRerunShot.mock.calls[0][0].sourceId).toBe(SOURCE_B.id)
  })

  it("offers no Compare or Replace on a batch", () => {
    // Both promote one output over *the* original, and with two sources there
    // is no such thing — offering them would ask which of two photos was meant.
    setup(batch(), null, [SOURCE, SOURCE_B])
    expect(screen.queryByLabelText("canvas.compare")).toBeNull()
    expect(screen.queryByLabelText("replaceOriginal")).toBeNull()
  })

  it("still offers them on a single-source run", () => {
    setup([succeeded("enhance")])
    expect(screen.queryByLabelText("canvas.compare")).not.toBeNull()
    expect(screen.queryByLabelText("replaceOriginal")).not.toBeNull()
  })

  it("spins only the busy node's action", () => {
    const runs = batch()
    render(
      <EnhanceCanvas
        runs={runs}
        sources={[SOURCE, SOURCE_B]}
        busy={{ kind: "discard", key: nodeKey(runs[1]!) }}
        onReplace={onReplace}
        onDone={onDone}
        onCancelRun={onCancelRun}
        onUseAsSource={onUseAsSource}
        onRerunShot={onRerunShot}
        onDiscardShot={onDiscardShot}
      />,
    )
    // One spinner, not two: keyed on the node, so the other source's identical
    // `enhance` output is unaffected.
    const spinners = document.querySelectorAll(".animate-spin")
    expect(spinners).toHaveLength(1)
  })
})
