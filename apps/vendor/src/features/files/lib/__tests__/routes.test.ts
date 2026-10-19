import { describe, expect, it } from "vitest"
import {
  fileDetailHref,
  fileViewHref,
  filesBasePath,
  filesListHref,
  parseFileDetailId,
  parseFileViewTab,
  studioHref,
  studioBatchHref,
  parseStudioIds,
  parseRunId,
  FILE_DETAIL_PARAM,
  MAX_BATCH_SOURCES,
} from "../routes"

const listQuery = "page=3&search=nike&types=image&types=pdf&sort=name-asc&view=grid"

describe("filesBasePath", () => {
  it("points at the list route for a shop", () => {
    expect(filesBasePath("ahmed-electronics")).toBe(
      "/store/ahmed-electronics/content/files",
    )
  })
})

describe("fileViewHref", () => {
  it("puts the file id in the path, not a query param", () => {
    expect(fileViewHref("acme", "att-1", "")).toBe(
      "/store/acme/content/files/att-1",
    )
  })

  it("carries every list param so closing restores the same list", () => {
    const href = fileViewHref("acme", "att-1", listQuery)
    const params = new URLSearchParams(href.split("?")[1])
    expect(params.get("page")).toBe("3")
    expect(params.get("search")).toBe("nike")
    expect(params.get("sort")).toBe("name-asc")
    expect(params.get("view")).toBe("grid")
    // `types` is a repeated key — both facets must survive the round trip.
    expect(params.getAll("types")).toEqual(["image", "pdf"])
  })

  it("marks the AI workspace and leaves edit implicit", () => {
    expect(fileViewHref("acme", "att-1", "", "ai")).toContain("tab=ai")
    expect(fileViewHref("acme", "att-1", "", "edit")).not.toContain("tab")
  })

  it("escapes an id that would otherwise break the path", () => {
    expect(fileViewHref("acme", "a b/c", "")).toBe(
      "/store/acme/content/files/a%20b%2Fc",
    )
  })

  it("accepts the read-only params object useSearchParams returns", () => {
    const readonlyish = { getAll: (k: string) => (k === "page" ? ["2"] : []) }
    expect(fileViewHref("acme", "att-1", readonlyish)).toBe(
      "/store/acme/content/files/att-1?page=2",
    )
  })
})

describe("filesListHref", () => {
  it("returns a bare path when nothing is filtered", () => {
    expect(filesListHref("acme", "")).toBe("/store/acme/content/files")
  })

  it("keeps the list's params", () => {
    const href = filesListHref("acme", listQuery)
    expect(href.startsWith("/store/acme/content/files?")).toBe(true)
    expect(new URLSearchParams(href.split("?")[1]).get("search")).toBe("nike")
  })

  it("drops the view's own params so the list can't reopen the editor", () => {
    // The href the view closes to is built from the view's URL, which still
    // carries `tab` — leaving it on would put a stale workspace on the list.
    expect(filesListHref("acme", "page=2&tab=ai")).toBe(
      "/store/acme/content/files?page=2",
    )
  })
})

describe("studioHref", () => {
  it("is a static sibling of the file view, so no id can shadow it", () => {
    expect(studioHref("acme")).toBe("/store/acme/content/files/studio")
  })

  it("carries the list params so its back link restores the same list", () => {
    const params = new URLSearchParams(studioHref("acme", listQuery).split("?")[1])
    expect(params.get("page")).toBe("3")
    expect(params.getAll("types")).toEqual(["image", "pdf"])
  })

  it("drops tab — the studio has no workspaces to restore", () => {
    expect(studioHref("acme", "page=2&tab=ai")).toBe(
      "/store/acme/content/files/studio?page=2",
    )
  })

  // The hand-off after a source is picked has to land on the same list state
  // the studio was opened with, or the vendor loses their filters mid-flow.
  it("hands its params on to the file view it forwards to", () => {
    const studio = studioHref("acme", listQuery)
    const carried = studio.split("?")[1]
    const handoff = fileViewHref("acme", "att-9", carried, "ai")
    expect(handoff.startsWith("/store/acme/content/files/att-9?")).toBe(true)
    const params = new URLSearchParams(handoff.split("?")[1])
    expect(params.get("search")).toBe("nike")
    expect(params.get("tab")).toBe("ai")
  })
})

describe("parseFileViewTab", () => {
  it("reads the AI workspace, case-insensitively", () => {
    expect(parseFileViewTab("ai")).toBe("ai")
    expect(parseFileViewTab("AI")).toBe("ai")
  })

  it("falls back to edit for anything else", () => {
    expect(parseFileViewTab(null)).toBe("edit")
    expect(parseFileViewTab(undefined)).toBe("edit")
    expect(parseFileViewTab("")).toBe("edit")
    expect(parseFileViewTab("studio")).toBe("edit")
  })

  it("takes the first value when the key is repeated", () => {
    expect(parseFileViewTab(["ai", "edit"])).toBe("ai")
  })
})

describe("studioBatchHref / parseStudioIds", () => {
  it("round-trips a selection through the URL", () => {
    const href = studioBatchHref("acme", ["a", "b", "c"])
    expect(href).toBe(
      "/store/acme/content/files/studio?ids=a&ids=b&ids=c",
    )
    expect(parseStudioIds(href.split("?")[1]!)).toEqual(["a", "b", "c"])
  })

  it("repeats the key instead of joining, because an id is opaque", () => {
    // Any delimiter we picked could appear inside an id. `types` is carried the
    // same way for the same reason.
    const href = studioBatchHref("acme", ["a,b", "c"])
    expect(parseStudioIds(href.split("?")[1]!)).toEqual(["a,b", "c"])
  })

  it("carries the list's own params so the back link still works", () => {
    const href = studioBatchHref("acme", ["a"], "page=3&search=mug&tab=ai")
    expect(href).toContain("page=3")
    expect(href).toContain("search=mug")
    // `tab` belongs to the file view, not to the studio.
    expect(href).not.toContain("tab=ai")
  })

  it("caps the batch on the way out", () => {
    const ids = Array.from({ length: MAX_BATCH_SOURCES + 5 }, (_, i) => `id${i}`)
    const href = studioBatchHref("acme", ids)
    expect(parseStudioIds(href.split("?")[1]!)).toHaveLength(MAX_BATCH_SOURCES)
  })

  it("caps and de-dupes on the way in too", () => {
    // The URL is vendor-editable, so a hand-typed hundred-id link must not
    // become a hundred-source run — the selection is a spend multiplier.
    const params = new URLSearchParams()
    for (let i = 0; i < MAX_BATCH_SOURCES + 10; i++) params.append("ids", `id${i}`)
    expect(parseStudioIds(params.toString())).toHaveLength(MAX_BATCH_SOURCES)

    expect(parseStudioIds("ids=a&ids=a&ids=b")).toEqual(["a", "b"])
  })

  it("reads no ids off an ordinary studio link", () => {
    expect(parseStudioIds(studioHref("acme").split("?")[1] ?? "")).toEqual([])
  })

  it("drops ids when going back to the list", () => {
    // Otherwise closing the batch would leave the selection on the list URL and
    // re-open it on the next click.
    expect(filesListHref("acme", "ids=a&ids=b&page=2")).toBe(
      "/store/acme/content/files?page=2",
    )
  })
})

describe("parseRunId", () => {
  it("reads the run being reviewed", () => {
    expect(parseRunId("run=abc123")).toBe("abc123")
    expect(parseRunId("page=2&run=abc123&ids=x")).toBe("abc123")
  })

  it("is null when no review is being restored", () => {
    expect(parseRunId("")).toBeNull()
    expect(parseRunId("page=2")).toBeNull()
    // An empty value is "no run", not a run whose id is the empty string —
    // otherwise the studio would fire a restore that can only ever return
    // nothing.
    expect(parseRunId("run=")).toBeNull()
  })

  it("takes the first when the URL repeats it", () => {
    expect(parseRunId("run=a&run=b")).toBe("a")
  })

  it("is dropped when returning to the list", () => {
    // A run belongs to the studio. Carried back it would sit on the list URL
    // and be handed to the next file the vendor opened.
    expect(filesListHref("acme", "run=abc&page=2")).toBe(
      "/store/acme/content/files?page=2",
    )
  })

  it("survives alongside a batch selection", () => {
    // The two halves of a restorable batch: what it runs on, and which run.
    const url = "ids=a&ids=b&run=r1"
    expect(parseStudioIds(url)).toEqual(["a", "b"])
    expect(parseRunId(url)).toBe("r1")
  })
})

describe("fileDetailHref / parseFileDetailId", () => {
  it("names the key the page reads", () => {
    expect(FILE_DETAIL_PARAM).toBe("file")
  })

  it("puts the sheet's file on the list route as a query param", () => {
    // A PDF has no route of its own; the list plus this param is its only URL.
    expect(fileDetailHref("acme", "att-1", "")).toBe(
      "/store/acme/content/files?file=att-1",
    )
  })

  it("carries the list params so the list under the sheet is unchanged", () => {
    const href = fileDetailHref("acme", "att-1", listQuery)
    const params = new URLSearchParams(href.split("?")[1])
    expect(params.get("file")).toBe("att-1")
    expect(params.get("page")).toBe("3")
    expect(params.get("search")).toBe("nike")
    expect(params.get("sort")).toBe("name-asc")
    expect(params.get("view")).toBe("grid")
    expect(params.getAll("types")).toEqual(["image", "pdf"])
  })

  it("drops the view's and the studio's own params", () => {
    // Built from the list allow-list, so a `tab`, `run` or `ids` still on the
    // source URL never rides along onto the sheet.
    expect(fileDetailHref("acme", "att-1", "page=2&tab=ai&run=r1&ids=a")).toBe(
      "/store/acme/content/files?page=2&file=att-1",
    )
  })

  it("replaces a sheet already open rather than stacking a second id", () => {
    expect(fileDetailHref("acme", "att-2", "file=att-1&page=2")).toBe(
      "/store/acme/content/files?page=2&file=att-2",
    )
  })

  it("reads the open sheet's file", () => {
    expect(parseFileDetailId("file=att-1")).toBe("att-1")
    expect(parseFileDetailId("page=2&file=att-1&search=x")).toBe("att-1")
    expect(parseFileDetailId(new URLSearchParams("file=att-1"))).toBe("att-1")
  })

  it("is null when no sheet is open", () => {
    expect(parseFileDetailId("")).toBeNull()
    expect(parseFileDetailId("page=2")).toBeNull()
    // An empty value is "no sheet", not a sheet for the empty-string id —
    // otherwise the page would fire a by-id read that can only return nothing.
    expect(parseFileDetailId("file=")).toBeNull()
  })

  it("takes the first when the URL repeats it", () => {
    expect(parseFileDetailId("file=a&file=b")).toBe("a")
  })

  it("is dropped by every other href, so nothing can re-open it", () => {
    // Not in the list allow-list on purpose: closing the editor or the studio
    // rebuilds the list href from its own URL, and a sheet id carried there
    // would put the panel back up on a list the vendor had just returned to.
    expect(filesListHref("acme", "file=att-1&page=2")).toBe(
      "/store/acme/content/files?page=2",
    )
    expect(fileViewHref("acme", "att-9", "file=att-1")).not.toContain("file=")
    expect(studioHref("acme", "file=att-1")).not.toContain("file=")
    expect(studioBatchHref("acme", ["a"], "file=att-1")).not.toContain("file=")
  })
})
