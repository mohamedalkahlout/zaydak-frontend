import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "@/shared/messages/en"
import { SIGNUP_PROGRESS_KEY } from "../../lib/progress"

/**
 * Login → Create must start at the email pane, even when this tab still holds
 * a half-filled wizard. Refresh on `/register` is the one visit that may
 * restore.
 */

const storedPersonal = {
  pane: "personal",
  email: "vendor@example.com",
  personal: { name: "Ada Lovelace", countryCode: "SA", phone: "0550000000" },
  draft: null,
}

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...rest
  }: {
    children: React.ReactNode
    href: string
    onClick?: (event: React.MouseEvent) => void
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
  useLazyQuery: () => [vi.fn(), { loading: false }],
  useApolloClient: () => ({ query: vi.fn(), mutate: vi.fn() }),
}))

vi.mock("@repo/ui/components/shader-background", () => ({
  ShaderBackground: () => null,
}))

vi.mock("@/shared/components/app-image", () => ({
  default: ({ alt, ...rest }: { alt: string }) => <img alt={alt} {...rest} />,
}))

vi.mock("@/shared/components/locale-switcher", () => ({
  LocaleSwitcher: () => null,
}))

vi.mock("@/shared/stores/auth", () => ({
  useAuthStore: (sel: (s: { setTokens: () => void }) => unknown) =>
    sel({ setTokens: vi.fn() }),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const { SignupWizard } = await import("../signup-wizard")
const LoginPage = (await import("@/app/(auth)/login/page")).default

function plantPersonalProgress() {
  sessionStorage.setItem(SIGNUP_PROGRESS_KEY, JSON.stringify(storedPersonal))
}

describe("SignupWizard progress", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("restores the parked pane after a refresh on /register", async () => {
    plantPersonalProgress()
    render(<SignupWizard />)

    await waitFor(() => {
      expect(screen.getByText(en.signup.personal.title)).toBeTruthy()
    })
    expect(screen.queryByText(en.signup.email.title)).toBeNull()
  })

  it("starts at step 1 after Login → Create, ignoring parked progress", async () => {
    plantPersonalProgress()
    render(<LoginPage />)

    await waitFor(() => {
      expect(sessionStorage.getItem(SIGNUP_PROGRESS_KEY)).toBeNull()
    })

    cleanup()
    render(<SignupWizard />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.getByText(en.signup.email.title)).toBeTruthy()
    expect(screen.queryByText(en.signup.personal.title)).toBeNull()
    expect(screen.queryByDisplayValue("Ada Lovelace")).toBeNull()
  })

  it("starts at step 1 on a new visit after closing the site", async () => {
    plantPersonalProgress()
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type: "navigate" },
    ] as unknown as PerformanceEntryList)

    render(<SignupWizard />)

    await waitFor(() => {
      expect(sessionStorage.getItem(SIGNUP_PROGRESS_KEY)).toBeNull()
    })
    expect(screen.getByText(en.signup.email.title)).toBeTruthy()
    expect(screen.queryByText(en.signup.personal.title)).toBeNull()
    expect(screen.queryByDisplayValue("Ada Lovelace")).toBeNull()
  })
})
