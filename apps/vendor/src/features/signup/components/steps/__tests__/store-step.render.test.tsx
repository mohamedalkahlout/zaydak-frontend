import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
  useQuery: () => ({
    data: {
      enabledCountryProfiles: {
        success: true,
        data: [{ country_code: "PS", default_currency: "ILS" }],
      },
    },
    loading: false,
  }),
}))

vi.mock("@repo/ui/components/shader-background", () => ({
  ShaderBackground: () => null,
}))

vi.mock("@/shared/components/app-image", () => ({
  default: ({ alt, ...rest }: { alt: string }) => <img alt={alt} {...rest} />,
}))

vi.mock("@/shared/stores/auth", () => ({
  useAuthStore: (sel: (s: { setTokens: () => void }) => unknown) =>
    sel({ setTokens: vi.fn() }),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { StoreStep } = await import("../store-step")

const draft = {
  signup_token: "token",
  destination_masked: "a***@b.com",
  channel: "EMAIL" as const,
  code_length: 6,
  resend_after: 0,
}

describe("StoreStep", () => {
  it("matches create-store: country picker first, no name/slug fields", () => {
    render(
      <StoreStep
        draft={draft}
        phoneCountryCode="PS"
        onSessionLost={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByText("Where does your business operate?")).toBeTruthy()
    expect(screen.getByText("Palestine")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy()

    expect(screen.queryByLabelText("Store name")).toBeNull()
    expect(screen.queryByLabelText("Store link")).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByText(/My Store/)).toBeNull()
  })
})
