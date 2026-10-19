import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import en from "@/shared/messages/en.json"
import { ModerationDashboard } from "../components/moderation-dashboard"
import { sileo } from "sileo"

const mockMutate = vi.fn(() => Promise.resolve({ data: { success: true } }))

const mockBecameSeller = {
  data: {
    becameSellerRequests: {
      success: true,
      data: [
        {
          id: "req-1",
          user_id: "user-101",
          status: "pending",
          url: "https://myshop.com",
          name: "Merchant John",
          phone: "+966500000001",
          message: "Would like to sell electronics",
          created_at: "2026-09-01T10:00:00.000Z",
          updated_at: "2026-09-01T10:00:00.000Z",
        },
      ],
      meta: {
        page: 1,
        limit: 15,
        total: 1,
        total_pages: 1,
      },
    },
  },
}

const mockAbusiveReports = {
  data: {
    abusiveReports: {
      success: true,
      data: [
        {
          id: "rep-1",
          message: "Offensive counterfeit product",
          user_id: "user-202",
          model_type: "Product",
          model_id: "prod-999",
          created_at: "2026-09-02T12:00:00.000Z",
        },
      ],
      meta: {
        page: 1,
        limit: 15,
        total: 1,
        total_pages: 1,
      },
    },
  },
}

const mockAuditAnomalies = {
  data: {
    auditAnomalies: {
      success: true,
      data: {
        window_from: "2026-09-10T00:00:00Z",
        window_to: "2026-09-11T00:00:00Z",
        hours_back: 24,
        total_events: 1520,
        sensitive_events_count: 8,
        top_users: [{ user_id: "user-1", user_name: "Admin", action_count: 150 }],
        spikes: [
          {
            user_id: "user-attacker",
            user_name: "Suspicious User",
            recent_count: 85,
            baseline_count: 5,
            spike_ratio: 17.0,
          },
        ],
        sensitive_events: [
          {
            id: "evt-1",
            user_id: "admin-1",
            user_name: "Super Admin",
            action: "delete_user",
            entity: "User",
            entity_id: "user-999",
            ip: "192.168.1.1",
            created_at: "2026-09-11T08:00:00Z",
          },
        ],
        recent_critical: [],
      },
    },
  },
}

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: any) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "AdminBecameSellerRequests") return { ...mockBecameSeller, loading: false, refetch: vi.fn() }
    if (name === "AdminAbusiveReports") return { ...mockAbusiveReports, loading: false, refetch: vi.fn() }
    if (name === "AdminAuditAnomalies") return { ...mockAuditAnomalies, loading: false, refetch: vi.fn() }
    return { data: null, loading: false, refetch: vi.fn() }
  },
  useMutation: () => [mockMutate, { loading: false }],
}))

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as any,
        namespace: namespace as never,
      }),
    useLocale: () => "en",
  }
})

vi.mock("sileo", () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("ModerationDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the dashboard header and default seller requests tab", () => {
    render(<ModerationDashboard />)

    expect(screen.getByText("Moderation & Governance")).toBeDefined()
    expect(screen.getByText("Merchant John")).toBeDefined()
    expect(screen.getByText("Would like to sell electronics")).toBeDefined()
    expect(screen.getByText("Approve")).toBeDefined()
    expect(screen.getByText("Reject")).toBeDefined()
  })

  it("opens confirmation dialog and executes approve action", async () => {
    render(<ModerationDashboard />)

    const approveBtn = screen.getByText("Approve")
    fireEvent.click(approveBtn)

    // Confirmation dialog appears
    expect(screen.getByText("Approve seller request from Merchant John?")).toBeDefined()

    const confirmBtns = screen.getAllByRole("button", { name: "Approve" })
    fireEvent.click(confirmBtns[confirmBtns.length - 1])

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        variables: { id: "req-1" },
      })
      expect(sileo.success).toHaveBeenCalledWith({
        title: "Approved seller request from Merchant John",
      })
    })
  })

  it("switches to Abusive Reports tab and displays reports", () => {
    render(<ModerationDashboard />)

    const reportsTab = screen.getByText("Abusive Reports")
    fireEvent.click(reportsTab)

    expect(screen.getByText("Offensive counterfeit product")).toBeDefined()
    expect(screen.getByText("prod-999")).toBeDefined()
  })

  it("switches to Audit Anomalies tab and displays metrics & spikes", () => {
    render(<ModerationDashboard />)

    const anomaliesTab = screen.getByText("Security & Audit Anomalies")
    fireEvent.click(anomaliesTab)

    expect(screen.getByText("Rate Spikes & Anomalies")).toBeDefined()
    expect(screen.getByText("Suspicious User")).toBeDefined()
    expect(screen.getByText("17.0x")).toBeDefined()
    expect(screen.getByText("delete_user")).toBeDefined()
  })
})
