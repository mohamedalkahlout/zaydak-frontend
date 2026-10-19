import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { renderLightMarkdown } from "./light-markdown"

/**
 * The renderer exists because free-tier models emit markdown the prompt
 * forbids, so the cases worth pinning are the ones the vendor actually saw
 * (`**bold**`, a numbered field list) plus the guarantee that an ordinary
 * plain-text reply is not reshaped on its way to the bubble.
 */
function html(text: string, query = "") {
  const { container } = render(
    <div>{renderLightMarkdown(text, query)}</div>,
  )
  return container.firstElementChild as HTMLElement
}

describe("renderLightMarkdown", () => {
  it("leaves plain text and its newlines exactly as they were", () => {
    const el = html("مبيعات اليوم 1,240 ر.س.\nمن 8 طلبات.")
    expect(el.textContent).toBe("مبيعات اليوم 1,240 ر.س.\nمن 8 طلبات.")
    expect(el.querySelector("strong")).toBeNull()
    expect(el.querySelector("ul")).toBeNull()
  })

  it("renders **bold** as emphasis instead of printing the asterisks", () => {
    const el = html("4. **تصنيف المنتج** (مثل: إلكترونيات)")
    expect(el.textContent).not.toContain("**")
    expect(el.querySelector("strong")?.textContent).toBe("تصنيف المنتج")
  })

  it("lifts a numbered run into an ordered list that keeps its first number", () => {
    const el = html("أحتاج:\n1. الاسم\n2. السعر\n4. التصنيف")
    const ol = el.querySelector("ol")!
    expect(ol.getAttribute("start")).toBe("1")
    expect([...ol.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "الاسم",
      "السعر",
      "التصنيف",
    ])
    // The lead-in line stays prose above the list.
    expect(el.textContent).toContain("أحتاج:")
  })

  it("lifts a dash run into a bullet list and pads on the logical side", () => {
    const el = html("- ساعة كلاسيك\n- ساعة برو")
    const ul = el.querySelector("ul")!
    expect(ul.className).toContain("ps-5")
    expect(ul.querySelectorAll("li")).toHaveLength(2)
  })

  it("strips heading hashes and table pipes down to their text", () => {
    const el = html("## الملخص\n| المنتج | السعر |\n|---|---|\n| ساعة | 450 |")
    expect(el.textContent).not.toContain("#")
    expect(el.textContent).not.toContain("|")
    expect(el.textContent).toContain("الملخص")
    expect(el.textContent).toContain("ساعة · 450")
  })

  it("renders inline code and drops fence markers without eating the code", () => {
    const el = html("```\nSKU W-101\n```\nاستخدم `W-101`.")
    expect(el.textContent).not.toContain("```")
    expect(el.textContent).toContain("SKU W-101")
    expect(el.querySelector("code")?.textContent).toBe("W-101")
  })

  it("never emits a link, even when the model writes one", () => {
    const el = html("افتح [الصفحة](https://evil.example) الآن")
    expect(el.querySelector("a")).toBeNull()
    expect(el.textContent).toContain("[الصفحة](https://evil.example)")
  })

  it("keeps the find bar working inside bold runs and list items", () => {
    const el = html("**ساعة كلاسيك**\n- ساعة برو", "ساعة")
    const marks = [...el.querySelectorAll("mark")].map((m) => m.textContent)
    expect(marks).toEqual(["ساعة", "ساعة"])
  })
})
