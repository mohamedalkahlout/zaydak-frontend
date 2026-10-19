import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { SimpleEditor } from "../simple-editor"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// `useIsBreakpoint` reads matchMedia, which jsdom does not ship. `false` keeps
// the desktop toolbar, where every control is on screen at once.
if (typeof globalThis.matchMedia !== "function") {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }))
}

afterEach(cleanup)

/**
 * The toolbar is upstream Tiptap scaffold whose labels now come from the
 * `editor` namespace. A key that is missing from the catalogue renders as its
 * own path, so asserting the English copy is what proves every lookup lands.
 */
describe("<SimpleEditor /> toolbar copy", () => {
  it("names every control from the editor catalogue", () => {
    render(<SimpleEditor value="" onChange={() => {}} enableAiMenu />)

    expect(screen.getByRole("toolbar", { name: "toolbar" })).toBeTruthy()

    for (const name of [
      "Undo",
      "Redo",
      "Format text as heading",
      "List options",
      "Blockquote",
      "Code Block",
      "Bold",
      "Italic",
      "Strike",
      "Code",
      "Underline",
      "Highlight",
      "Link",
      "Superscript",
      "Subscript",
      "Align left",
      "Align center",
      "Align right",
      "Align justify",
      "Add image",
      "Ask AI",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy()
    }

    expect(screen.getByText("Add")).toBeTruthy()
  })
})
