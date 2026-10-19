import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { ProductFormLayout } from "../form/product-form-layout"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn() }),
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

function TestHarness({
  forceDirty = false,
  beforeDiscard,
}: {
  forceDirty?: boolean
  beforeDiscard?: () => void
}) {
  const form = useForm({
    defaultValues: { name: "Test Product" },
  })

  return (
    <ProductFormLayout
      title="Edit product"
      form={form as any}
      onValid={vi.fn()}
      forceDirty={forceDirty}
      beforeDiscard={beforeDiscard}
    >
      <div>
        <input
          aria-label="product-name"
          {...form.register("name")}
        />
      </div>
    </ProductFormLayout>
  )
}

const guard = () => useLeaveGuardStore.getState()
const bar = () => useUnsavedBarStore.getState()

beforeEach(() => {
  vi.clearAllMocks()
  useLeaveGuardStore.setState({ guard: null, pending: null })
  useUnsavedBarStore.getState().hide()
})

describe("ProductFormLayout", () => {
  it("keeps the leave guard disarmed and unsaved bar hidden when pristine", () => {
    render(<TestHarness />)
    expect(guard().guard).toBeNull()
    expect(bar().active).toBe(false)
  })

  it("arms the leave guard and shows unsaved bar when forceDirty is true", () => {
    render(<TestHarness forceDirty={true} />)
    expect(guard().guard).not.toBeNull()
    expect(bar().active).toBe(true)
  })

  it("arms the leave guard and shows unsaved bar once a field is modified", () => {
    render(<TestHarness />)
    expect(guard().guard).toBeNull()
    expect(bar().active).toBe(false)

    const input = screen.getByLabelText("product-name")
    fireEvent.change(input, { target: { value: "Changed Name" } })

    expect(guard().guard).not.toBeNull()
    expect(bar().active).toBe(true)
  })

  it("executes beforeDiscard and hides unsaved bar when leave guard fires onLeave", () => {
    const beforeDiscard = vi.fn()
    render(<TestHarness forceDirty={true} beforeDiscard={beforeDiscard} />)

    expect(guard().guard).not.toBeNull()
    expect(bar().active).toBe(true)

    // Invoke onLeave registered by useLeaveGuard
    guard().guard?.onLeave?.()

    expect(beforeDiscard).toHaveBeenCalledTimes(1)
    expect(bar().active).toBe(false)
  })
})
