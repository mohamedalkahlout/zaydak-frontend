import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

/**
 * The run history is a list of **links**, and the links are the whole logic:
 * where a run reopens is decided by its sources, not by where it was fired. So
 * that mapping is what these pin — a one-source run must land on that file's
 * studio, a batch on the batch studio with its selection restored, and a run
 * whose sources are gone must not offer a link that goes nowhere.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const h = vi.hoisted(() => ({
  runs: { loading: false, data: undefined as unknown },
}))

vi.mock("@apollo/client/react", () => ({ useQuery: () => h.runs }))

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
  useSearchParams: () => new URLSearchParams("page=2"),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  useLocale: () => "en",
}))

const { EnhanceRunHistory } = await import("../enhance-run-history")

const run = (o: Record<string, unknown> = {}) => ({
  run_id: "r1",
  created_at: "2026-07-30T10:00:00.000Z",
  total: 3,
  succeeded: 3,
  failed: 0,
  pending: 0,
  source_ids: ["src-1"],
  thumbnails: ["https://cdn/a.jpg"],
  ...o,
})

const setup = (runs: Record<string, unknown>[], activeRunId?: string) => {
  h.runs = {
    loading: false,
    data: { enhanceRuns: { success: true, data: runs } },
  }
  return render(<EnhanceRunHistory activeRunId={activeRunId} />)
}

const links = () =>
  [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"))

beforeEach(() => {
  h.runs = { loading: false, data: undefined }
})

describe("EnhanceRunHistory", () => {
  it("renders nothing at all when there is no history", () => {
    // Absent rather than an empty state: a vendor who has never run anything is
    // being asked to configure their first, and a row saying so is chrome in
    // the way of that.
    const { container } = setup([])
    expect(container.textContent).toBe("")
  })

  it("reopens a one-source run on that file's studio", () => {
    setup([run({ source_ids: ["src-1"] })])
    const [href] = links()
    expect(href).toContain("/store/acme/content/files/src-1")
    expect(href).toContain("tab=ai")
    expect(href).toContain("run=r1")
  })

  it("reopens a multi-source run on the batch studio, selection restored", () => {
    setup([run({ source_ids: ["a", "b", "c"] })])
    const [href] = links()
    // The batch route, carrying both halves: what it ran on and which run.
    expect(href).toContain("/content/files/studio")
    expect(href).toContain("ids=a")
    expect(href).toContain("ids=b")
    expect(href).toContain("ids=c")
    expect(href).toContain("run=r1")
  })

  it("carries the list params so the back link still works", () => {
    setup([run()])
    expect(links()[0]).toContain("page=2")
  })

  it("lists a run whose sources are gone, but offers no link", () => {
    // The run happened and its images are in the library. What is gone is
    // somewhere to reopen it — so the row stays and is inert, rather than
    // vanishing (which would read as the run never having existed) or
    // linking somewhere that resolves to nothing.
    setup([run({ source_ids: [] })])
    expect(links()).toHaveLength(0)
    expect(screen.queryByTitle("history.sourcesGone")).not.toBeNull()
  })

  it("reports still-generating ahead of failures", () => {
    setup([run({ succeeded: 1, failed: 1, pending: 1 })])
    // A run still working is not a run that went wrong; saying so first stops a
    // slow batch reading as a broken one.
    expect(screen.queryByText('history.pending:{"count":1}')).not.toBeNull()
    expect(screen.queryByText('history.failed:{"count":1}')).toBeNull()
  })

  it("reports failures once nothing is pending", () => {
    setup([run({ succeeded: 2, failed: 1, pending: 0 })])
    expect(screen.queryByText('history.failed:{"count":1}')).not.toBeNull()
  })

  it("says so plainly when every shot produced an image", () => {
    setup([run({ succeeded: 3, failed: 0, pending: 0 })])
    expect(screen.queryByText("history.allGood")).not.toBeNull()
  })

  it("marks the run currently on the canvas", () => {
    const { container } = setup([run({ run_id: "r1" }), run({ run_id: "r2" })], "r2")
    const rows = [...container.querySelectorAll("a")]
    expect(rows[0]!.className).not.toContain("border-violet-500")
    expect(rows[1]!.className).toContain("border-violet-500")
  })

  it("falls back to a placeholder when a run produced no thumbnails", () => {
    // A run where everything failed has nothing to show, and an empty strip
    // would collapse the row into unreadable text.
    const { container } = setup([
      run({ succeeded: 0, failed: 3, thumbnails: [] }),
    ])
    expect(container.querySelectorAll("img")).toHaveLength(0)
    expect(container.querySelector("svg")).not.toBeNull()
  })
})
