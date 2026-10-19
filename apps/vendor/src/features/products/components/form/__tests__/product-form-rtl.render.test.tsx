import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import {
  LangTabsBar,
  LocaleProvider,
} from "../ui/lang-tabs"
import { TranslatableInput } from "../ui/translatable-input"
import type { ProductFormApi, ProductFormInput } from "@/features/products/validations/product"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

function Harness({
  defaultValues = { name: { en: "Classic Hoodie", ar: "هودي كلاسيكي" } },
  onForm,
}: {
  defaultValues?: Partial<ProductFormInput>
  onForm?: (form: ProductFormApi) => void
}) {
  const form = useForm<ProductFormInput>({
    defaultValues: defaultValues as any,
  })

  onForm?.(form as unknown as ProductFormApi)

  return (
    <LocaleProvider>
      <div dir="ltr" data-testid="form-wrapper">
        <LangTabsBar />
        <div className="flex flex-col gap-4">
          <label htmlFor="title-input">Product Title</label>
          <TranslatableInput
            form={form as unknown as ProductFormApi}
            name="name"
            placeholder="Product title"
          />
        </div>
      </div>
    </LocaleProvider>
  )
}

describe("RTL Layout & Multilingual Pill Rendering (<LocaleProvider /> & <TranslatableInput />)", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("starts in English LTR mode and switches to Arabic RTL mode upon clicking AR pill", () => {
    render(<Harness />)

    const enButton = screen.getByRole("button", { name: "EN" })
    const arButton = screen.getByRole("button", { name: "AR" })

    expect(enButton.getAttribute("aria-pressed")).toBe("true")
    expect(arButton.getAttribute("aria-pressed")).toBe("false")

    // Initially in EN: dir is ltr and input value is "Classic Hoodie"
    const inputEn = screen.getByPlaceholderText("Product title") as HTMLInputElement
    expect(inputEn.dir).toBe("ltr")
    expect(inputEn.value).toBe("Classic Hoodie")

    // Click AR pill
    fireEvent.click(arButton)

    expect(enButton.getAttribute("aria-pressed")).toBe("false")
    expect(arButton.getAttribute("aria-pressed")).toBe("true")

    // Now in AR: dir is rtl and input value is "هودي كلاسيكي"
    const inputAr = screen.getByPlaceholderText("Product title") as HTMLInputElement
    expect(inputAr.dir).toBe("rtl")
    expect(inputAr.value).toBe("هودي كلاسيكي")
  })

  it("updates Arabic translation without touching English value", () => {
    let formRef: ProductFormApi | null = null

    render(
      <Harness
        defaultValues={{ name: { en: "Leather Bag", ar: "" } }}
        onForm={(f) => {
          formRef = f
        }}
      />,
    )

    const arButton = screen.getByRole("button", { name: "AR" })
    fireEvent.click(arButton)

    const inputAr = screen.getByPlaceholderText("Product title") as HTMLInputElement
    expect(inputAr.dir).toBe("rtl")
    expect(inputAr.value).toBe("")

    // Enter Arabic title
    fireEvent.change(inputAr, { target: { value: "حقيبة جلدية" } })

    const values = formRef!.getValues()
    expect(values.name).toEqual({
      en: "Leather Bag",
      ar: "حقيبة جلدية",
    })
  })

  it("applies RTL container attribute when root document or section has dir='rtl'", () => {
    const { container } = render(
      <div dir="rtl" className="vendor-admin-rtl">
        <Harness defaultValues={{ name: { en: "Shoes", ar: "أحذية" } }} />
      </div>,
    )

    const wrapper = container.querySelector(".vendor-admin-rtl") as HTMLElement
    expect(wrapper.getAttribute("dir")).toBe("rtl")

    const arButton = screen.getByRole("button", { name: "AR" })
    fireEvent.click(arButton)

    const titleInput = screen.getByPlaceholderText("Product title") as HTMLInputElement
    expect(titleInput.dir).toBe("rtl")
    expect(titleInput.value).toBe("أحذية")
  })
})
