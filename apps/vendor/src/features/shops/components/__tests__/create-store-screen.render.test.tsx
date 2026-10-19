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
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { CreateStoreScreen } = await import("../create-store-screen")

describe("CreateStoreScreen", () => {
  it("asks for the declared business country before store types", () => {
    render(<CreateStoreScreen />)

    expect(screen.getByText("Where does your business operate?")).toBeTruthy()
    expect(screen.getByText("Palestine")).toBeTruthy()
    expect(screen.getByText("ILS")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByText(/My Store/)).toBeNull()
  })
})
