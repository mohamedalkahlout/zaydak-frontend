import { describe, expect, it } from "vitest"

import { imageRef, imageRefs, text } from "../multilang"

describe("text", () => {
  it("picks the active locale", () => {
    expect(text({ en: "Mug", ar: "كوب" }, "ar")).toBe("كوب")
  })

  it("falls back to another locale that has text", () => {
    // A vendor who filled in only English has a real product; rendering an
    // empty heading for it under `ar` would look broken, not untranslated.
    expect(text({ en: "Mug", ar: "" }, "ar")).toBe("Mug")
    expect(text({ en: "Mug" }, "ar")).toBe("Mug")
  })

  it("treats whitespace as empty", () => {
    expect(text({ en: "Mug", ar: "   " }, "ar")).toBe("Mug")
  })

  it("accepts a bare string, since a few fields are plain columns", () => {
    expect(text("Acme", "ar")).toBe("Acme")
  })

  it("returns the fallback for null, arrays and numbers", () => {
    expect(text(null, "en", "—")).toBe("—")
    expect(text(["a"], "en", "—")).toBe("—")
    expect(text(42, "en", "—")).toBe("—")
  })

  it("returns the fallback when every locale is empty", () => {
    expect(text({ en: "", ar: "" }, "en", "—")).toBe("—")
  })

  it("takes any non-empty value for a locale outside the supported set", () => {
    expect(text({ fr: "Tasse" }, "en")).toBe("Tasse")
  })
})

describe("imageRef", () => {
  it("reads an upload", () => {
    expect(
      imageRef({ id: "a1", original: "https://cdn/x.jpg", thumbnail: "https://cdn/t.jpg" }),
    ).toEqual({
      id: "a1",
      original: "https://cdn/x.jpg",
      thumbnail: "https://cdn/t.jpg",
    })
  })

  it("falls back to the original when there is no thumbnail", () => {
    // Older rows and anything ingested from a remote URL have no thumbnail;
    // passing undefined to `src` renders a broken image.
    expect(imageRef({ original: "https://cdn/x.jpg" })?.thumbnail).toBe(
      "https://cdn/x.jpg",
    )
    expect(
      imageRef({ original: "https://cdn/x.jpg", thumbnail: "" })?.thumbnail,
    ).toBe("https://cdn/x.jpg")
  })

  it("returns null for anything unrenderable", () => {
    expect(imageRef(null)).toBeNull()
    expect(imageRef({})).toBeNull()
    expect(imageRef({ original: "" })).toBeNull()
    expect(imageRef("https://cdn/x.jpg")).toBeNull()
  })
})

describe("imageRefs", () => {
  it("drops entries it cannot render", () => {
    expect(
      imageRefs([{ original: "https://cdn/a.jpg" }, {}, null, { original: "" }]),
    ).toHaveLength(1)
  })

  it("returns an empty array for a non-array", () => {
    expect(imageRefs(null)).toEqual([])
    expect(imageRefs({ original: "https://cdn/a.jpg" })).toEqual([])
  })
})
