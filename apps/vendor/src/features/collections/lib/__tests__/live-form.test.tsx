import { describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import {
  applyCollectionPatch,
  COLLECTION_CLEARED_VALUE,
  COLLECTION_PATCH_FIELDS,
  collectionSnapshot,
} from "../live-form"

/**
 * The collection create form as a live form: what it tells the assistant, and
 * how a `patch_form` result is staged back into it. The one thing worth more
 * than the others is the per-locale merge — a title the assistant gives in
 * one language must never blank the other.
 */

const DEFAULTS = {
  name: { en: "Summer Sale", ar: "تخفيضات الصيف" },
  description: { en: "Light pieces for hot days", ar: "" },
  seo_title: { en: "", ar: "" },
  seo_description: { en: "", ar: "" },
  slug: "summer-sale",
  is_published: true,
  product_ids: ["p1"],
}

describe("collectionSnapshot", () => {
  it("sends the title, description and handle, empty locales left out", () => {
    expect(collectionSnapshot(DEFAULTS)).toEqual({
      name: { en: "Summer Sale", ar: "تخفيضات الصيف" },
      description: { en: "Light pieces for hot days" },
      slug: "summer-sale",
    })
  })

  it("sends nothing the assistant cannot state in a message", () => {
    const snapshot = collectionSnapshot({
      ...DEFAULTS,
      sources: [{ kind: "PRODUCTS" }],
      image_url: "https://cdn.example/cover.jpg",
    })
    for (const key of [
      "product_ids",
      "sources",
      "image_url",
      "is_published",
      "seo_title",
    ]) {
      expect(snapshot).not.toHaveProperty(key)
    }
  })

  it("caps long text and leaves an empty form empty", () => {
    expect(collectionSnapshot({ name: { en: "x".repeat(500) } })).toEqual({
      name: { en: `${"x".repeat(119)}…` },
    })
    expect(
      collectionSnapshot({ name: { en: "", ar: " " }, slug: "" }),
    ).toEqual({})
  })
})

describe("applyCollectionPatch", () => {
  const setup = () =>
    renderHook(() => useForm({ defaultValues: DEFAULTS })).result

  it("renames in one language and keeps the other", () => {
    const form = setup()
    let applied: Record<string, unknown> = {}
    act(() => {
      applied = applyCollectionPatch(form.current as never, {
        name: { ar: "عروض الصيف" },
      })
    })
    expect(form.current.getValues("name")).toEqual({
      en: "Summer Sale",
      ar: "عروض الصيف",
    })
    expect(form.current.getFieldState("name").isDirty).toBe(true)
    // What goes back into the ticket is the whole pair, so a reload reopens
    // the form with both languages.
    expect(applied).toEqual({
      name: { en: "Summer Sale", ar: "عروض الصيف" },
    })
  })

  it("writes the handle", () => {
    const form = setup()
    act(() => {
      applyCollectionPatch(form.current as never, { slug: "summer-2026" })
    })
    expect(form.current.getValues("slug")).toBe("summer-2026")
  })

  it("empties a cleared description in both languages", () => {
    const form = setup()
    act(() => {
      applyCollectionPatch(form.current as never, {
        description: null,
        slug: null,
      })
    })
    expect(form.current.getValues("description")).toEqual({ en: "", ar: "" })
    expect(form.current.getValues("slug")).toBe("")
  })

  it("never empties the title, and never writes what is not text", () => {
    // The server refuses these; one that got here anyway must not blank a
    // required field or replace the products.
    const form = setup()
    let applied: Record<string, unknown> = {}
    act(() => {
      applied = applyCollectionPatch(form.current as never, {
        name: null,
        product_ids: [],
        is_published: false,
      })
    })
    expect(applied).toEqual({})
    expect(form.current.getValues("name")).toEqual(DEFAULTS.name)
    expect(form.current.getValues("product_ids")).toEqual(["p1"])
    expect(form.current.getValues("is_published")).toBe(true)
  })

  it("has a blank for exactly the fields the server may clear", () => {
    // Mirrors `COLLECTION_CLEARABLE_FIELDS` in
    // back-end/src/vendor-agent/tools/patch-collection-form.tool.ts.
    expect(Object.keys(COLLECTION_CLEARED_VALUE).sort()).toEqual(
      ["description", "seo_description", "seo_title", "slug"].sort(),
    )
    expect(COLLECTION_PATCH_FIELDS).toContain("name")
  })
})
