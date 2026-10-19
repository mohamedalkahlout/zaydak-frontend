import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

/**
 * The home banner is the dashboard's "go click the activation link" nag.
 * It keys off `me.email_verified`. After an email OTP that flag is true, so
 * the banner must not render — OTP-via-email is the verification.
 */

let emailVerified = false

function opName(doc: unknown): string {
  const defs = (doc as { definitions?: Array<{ name?: { value?: string } }> })
    ?.definitions
  return defs?.[0]?.name?.value ?? ""
}

vi.mock("@apollo/client/react", () => ({
  useSuspenseQuery: (doc: unknown) =>
    opName(doc) === "MyShops"
      ? { data: { myShops: { success: true, data: [] } } }
      : {
          data: {
            me: {
              data: {
                id: "u1",
                name: "Sara",
                email: "sara@acme.test",
                email_verified: emailVerified,
              },
            },
          },
        },
  useMutation: () => [vi.fn(), { loading: false }],
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/store/acme",
}))

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@/shared/components/site-header", () => ({
  SiteHeader: () => <div data-testid="site-header" />,
}))

vi.mock("@/shared/components/app-sidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}))

vi.mock("@/shared/components/leave-guard-dialog", () => ({
  LeaveGuardDialog: () => null,
}))

vi.mock("@repo/ui/components/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarInset: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="sidebar-inset" className={className}>
      {children}
    </div>
  ),
}))

vi.mock("@/features/ai/store-chat", () => ({
  useAiChatStore: (sel: (s: { open: boolean }) => unknown) =>
    sel({ open: false }),
}))

vi.mock("@/shared/lib/cookies", () => ({
  getCookie: () => "token",
}))

import { DashboardShell } from "../dashboard-shell"

describe("DashboardShell email verification banner", () => {
  beforeEach(() => {
    emailVerified = false
  })

  it("asks to verify the email when the address is still unverified", () => {
    render(
      <DashboardShell>
        <p>home</p>
      </DashboardShell>,
    )

    expect(screen.getByText("Verify your email")).toBeDefined()
    expect(
      screen.getByRole("button", { name: "Resend verification email" }),
    ).toBeDefined()
  })

  it("hides the banner once email OTP (or the activation link) has verified the address", () => {
    emailVerified = true
    render(
      <DashboardShell>
        <p>home</p>
      </DashboardShell>,
    )

    expect(screen.queryByText("Verify your email")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Resend verification email" }),
    ).toBeNull()
  })
})

describe("DashboardShell canvas radius", () => {
  it("squares the nav-adjacent corner and rounds the trailing (Sidekick) edge", () => {
    render(
      <DashboardShell>
        <p>home</p>
      </DashboardShell>,
    )

    const inset = screen.getByTestId("sidebar-inset")
    expect(inset.className).toContain("rounded-ss-none")
    expect(inset.className).toContain("rounded-se-2xl")
    expect(inset.className).not.toContain("rounded-tr-2xl")
    expect(inset.className).not.toContain("rounded-tl-none")
  })
})
