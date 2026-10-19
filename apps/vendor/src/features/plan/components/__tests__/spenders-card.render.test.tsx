import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { AiSpenders } from "../../types"

/**
 * The real English catalogue, so a missing `plan.spenders.*` key fails here
 * rather than rendering its own name at a merchant.
 */
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const useQuery = vi.fn()
vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}))

const { AiSpendersCard } = await import("../spenders-card")

const spenders = (over: Partial<AiSpenders> = {}): AiSpenders => ({
  rows: [],
  unattributed_turns: 0,
  total_turns: 0,
  period_start: "2026-09-01T00:00:00.000Z",
  period_end: "2026-10-01T00:00:00.000Z",
  ...over,
})

const answer = (data: AiSpenders | null, loading = false) =>
  useQuery.mockReturnValue({
    data: { myAiSpenders: { success: true, data } },
    loading,
  })

describe("AiSpendersCard", () => {
  beforeEach(() => useQuery.mockReset())

  /**
   * A shop with no entitlement row for the capability is not a shop that spent
   * nothing. Rendering an empty breakdown would make a claim we cannot support.
   */
  it("renders nothing at all when the shop is not metered", () => {
    answer(null)
    const { container } = render(<AiSpendersCard />)
    expect(container.innerHTML).toBe("")
  })

  it("lists a spender with their masked label and turn count", () => {
    answer(
      spenders({
        total_turns: 9,
        rows: [
          {
            key: "c:conv-1",
            channel: "WHATSAPP",
            label: "+97*******56",
            turns: 9,
            last_turn_at: "2026-09-15T00:00:00.000Z",
            conversation_id: "conv-1",
          },
        ],
      }),
    )
    render(<AiSpendersCard />)

    expect(screen.getByText("+97*******56")).toBeTruthy()
    expect(screen.getByText("WhatsApp")).toBeTruthy()
    expect(screen.getByText("9 calls")).toBeTruthy()
  })

  /**
   * A guest has no identity to print, so the channel name carries the row. The
   * server's four-character suffix is what tells two guests apart.
   */
  it("names a guest by their channel when there is no label", () => {
    answer(
      spenders({
        total_turns: 2,
        rows: [
          {
            key: "s:sess",
            channel: "STOREFRONT_GUEST",
            label: null,
            turns: 2,
            last_turn_at: "2026-09-15T00:00:00.000Z",
            conversation_id: null,
          },
        ],
      }),
    )
    render(<AiSpendersCard />)
    expect(screen.getByText("Guest")).toBeTruthy()
  })

  /**
   * The line the whole card is honest because of. Without it the list reads as
   * though it sums to the meter, and it does not.
   */
  it("shows the remainder the breakdown cannot name", () => {
    answer(
      spenders({
        total_turns: 30,
        unattributed_turns: 21,
        rows: [
          {
            key: "c:conv-1",
            channel: "WHATSAPP",
            label: "+97*******56",
            turns: 9,
            last_turn_at: "2026-09-15T00:00:00.000Z",
            conversation_id: "conv-1",
          },
        ],
      }),
    )
    render(<AiSpendersCard />)

    expect(screen.getByText("Not attributable")).toBeTruthy()
    expect(screen.getByText("21 calls")).toBeTruthy()
  })

  it("omits the remainder when everything is attributable", () => {
    answer(
      spenders({
        total_turns: 9,
        unattributed_turns: 0,
        rows: [
          {
            key: "c:conv-1",
            channel: "WHATSAPP",
            label: "+97*******56",
            turns: 9,
            last_turn_at: "2026-09-15T00:00:00.000Z",
            conversation_id: "conv-1",
          },
        ],
      }),
    )
    render(<AiSpendersCard />)
    expect(screen.queryByText("Not attributable")).toBeNull()
  })

  it("says so when a metered shop has spent nothing yet", () => {
    answer(spenders())
    render(<AiSpendersCard />)
    expect(
      screen.getByText("No customer has used the assistant yet this period."),
    ).toBeTruthy()
  })

  /**
   * The query takes no window arguments on purpose: the server reads the
   * entitlement period, so this card and the meters above it cannot drift.
   */
  it("asks for the period the server decides, not a window of its own", () => {
    answer(spenders())
    render(<AiSpendersCard />)
    const options = useQuery.mock.calls[0][1] as { variables?: unknown }
    expect(options?.variables).toBeUndefined()
  })
})
