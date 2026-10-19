import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { FormPatchCard } from "./form-patch-card"
import { useLiveFormStore } from "@/features/ai/store-live-form"
import type { FormPatchResult } from "@/features/ai/lib/types"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

/**
 * "Changed on the open form". What the card owes the vendor is what changed
 * and that it is not saved — and, when the form was gone before the patch
 * arrived, that nothing changed at all, so it never claims a change that did
 * not happen. (No jest-dom here: plain DOM assertions.)
 */

const result = (
  changed: FormPatchResult["form_patch"]["changed"],
): FormPatchResult => ({
  ok: true,
  form_patch: {
    patch_id: "patch-1",
    form_id: "h1",
    target: "product_create",
    values: {},
    changed,
  },
})

beforeEach(() => {
  useLiveFormStore.setState({ current: null, outcomes: {} })
})

describe("<FormPatchCard />", () => {
  it("lists each change, old value struck beside the new one", () => {
    const { container } = render(
      <FormPatchCard
        result={result([
          { field: "price", from: 200, to: 300 },
          { field: "status", from: "DRAFT", to: "PUBLISH" },
          { field: "track_quantity", from: true, to: false },
        ])}
        locale="en"
      />,
    )

    expect(screen.getByText("Changed on the open form")).toBeTruthy()
    expect(screen.getByText("Price")).toBeTruthy()
    expect(screen.getByText("300")).toBeTruthy()
    // The product screen's own word for PUBLISH.
    expect(screen.getByText("Active")).toBeTruthy()
    expect(screen.getByText("Off")).toBeTruthy()
    const struck = [...container.querySelectorAll(".line-through")].map(
      (el) => el.textContent,
    )
    expect(struck).toEqual(["200", "Draft", "On"])
    expect(
      screen.getByText("Nothing is saved until you press Save on the form."),
    ).toBeTruthy()
  })

  it("shows a translatable in the vendor's language", () => {
    render(
      <FormPatchCard
        result={result([
          { field: "name", from: { ar: "هودي" }, to: { ar: "هودي شتوي" } },
        ])}
        locale="ar"
      />,
    )
    expect(screen.getByText("هودي شتوي")).toBeTruthy()
  })

  it("shows a cleared field as struck through to nothing", () => {
    // `patch_form`'s `clear`: "شيل الخصم".
    const { container } = render(
      <FormPatchCard
        result={result([{ field: "sale_price", from: 190, to: null }])}
        locale="en"
      />,
    )
    expect(screen.getByText("Sale price")).toBeTruthy()
    expect(container.querySelector(".line-through")?.textContent).toBe("190")
    expect(screen.getByText("—")).toBeTruthy()
  })

  it("words a coupon patch in the coupon form's own terms", () => {
    // Field names and the fixed choices the form shows as labelled options:
    // never `value_type` or `percentage` as the model sent them.
    const { container } = render(
      <FormPatchCard
        result={result([
          { field: "amount", from: 20, to: 15 },
          { field: "value_type", from: "fixed", to: "percentage" },
          { field: "minimum_mode", from: "amount", to: "none" },
          { field: "limit_one_per_customer", from: false, to: true },
          { field: "expire_at_date", from: "2026-10-31", to: null },
          { field: "get_discount_mode", from: "percent", to: "free" },
        ])}
        locale="en"
      />,
    )

    for (const label of [
      "Discount value",
      "Value type",
      "Minimum requirement",
      "One use per customer",
      "End date",
      "Discount on what they get",
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText("Percentage")).toBeTruthy()
    expect(screen.getByText("None")).toBeTruthy()
    expect(screen.getByText("Free")).toBeTruthy()
    const struck = [...container.querySelectorAll(".line-through")].map(
      (el) => el.textContent,
    )
    expect(struck).toEqual([
      "20",
      "Fixed amount",
      "Purchase amount",
      "Off",
      "2026-10-31",
      "Percent off",
    ])
  })

  it("words a collection patch, the handle included", () => {
    render(
      <FormPatchCard
        result={result([
          { field: "name", from: { ar: "تخفيضات" }, to: { ar: "عروض الصيف" } },
          { field: "slug", from: "summer-sale", to: "summer-2026" },
        ])}
        locale="ar"
      />,
    )
    expect(screen.getByText("عروض الصيف")).toBeTruthy()
    expect(screen.getByText("URL handle")).toBeTruthy()
    expect(screen.getByText("summer-2026")).toBeTruthy()
  })

  it("does not strike an empty field it filled in", () => {
    const { container } = render(
      <FormPatchCard
        result={result([{ field: "sku", from: null, to: "HOOD-01" }])}
        locale="en"
      />,
    )
    expect(screen.getByText("HOOD-01")).toBeTruthy()
    expect(container.querySelectorAll(".line-through")).toHaveLength(0)
  })

  it("says nothing changed when the form was gone before the patch arrived", () => {
    useLiveFormStore.getState().recordOutcome("patch-1", "stale")
    render(
      <FormPatchCard
        result={result([{ field: "price", from: 200, to: 300 }])}
        locale="en"
      />,
    )
    expect(
      screen.getByText(
        "The form was closed before this arrived, so nothing changed.",
      ),
    ).toBeTruthy()
    expect(
      screen.queryByText("Nothing is saved until you press Save on the form."),
    ).toBeNull()
  })
})
