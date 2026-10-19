import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { FileEntry } from "@/features/files/types"

/**
 * The caption's path through the run hook.
 *
 * The panel hands the hook one line of the vendor's words; the hook has to put
 * it on every `enhanceImageShots` call, keep it for a re-roll, recover it from
 * a restored row, and — when the moderator refuses it — say that it was the
 * caption, since the shared copy for that code ("the request was blocked")
 * leaves the vendor guessing which of their inputs to change.
 *
 * Boundaries are mocked per the repo's hook-test convention: Apollo answers
 * from `h`, and `useTranslations` echoes the key.
 */

const h = vi.hoisted(() => ({
  enhanceShots: vi.fn(),
  cancel: vi.fn(),
  query: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ query: h.query }),
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => [
    doc?.definitions?.[0]?.name?.value === "CancelEnhanceGeneration"
      ? h.cancel
      : h.enhanceShots,
  ],
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/shared/lib/ai-image-errors", () => ({
  useAiImageError: () => (_err: unknown, fallback: string) => ({
    message: fallback,
    quota: false,
    upgrade: false,
  }),
}))

const { useEnhanceFile, recordedCaption } = await import("../use-enhance-file")

const file: FileEntry = {
  id: "att-1",
  filename: "mug.png",
  original_name: "mug.png",
  mime_type: "image/png",
  size: 1,
  url: "https://cdn/mug.png",
  context: "library",
  created_at: "2026-09-22T00:00:00Z",
  updated_at: "2026-09-22T00:00:00Z",
}

/** A generation that is already terminal, so the hook settles without polling. */
const done = (id: string, shot: string) => ({
  id,
  shot,
  status: "SUCCEEDED",
  error: null,
  results: [
    {
      id: `res-${id}`,
      attachment_id: `out-${id}`,
      url: `https://cdn/${id}.png`,
      thumbnail: null,
      selected: false,
    },
  ],
})

const answered = (...rows: ReturnType<typeof done>[]) => ({
  data: { enhanceImageShots: { success: true, data: rows } },
})

const inputOf = (call: number) =>
  h.enhanceShots.mock.calls[call][0].variables.input as Record<string, unknown>

const refused = (field: string) =>
  new CombinedGraphQLErrors({
    errors: [
      {
        message: "Validation failed",
        extensions: {
          error_code: "VALIDATION_ERROR",
          validation_errors: [
            {
              field,
              code: "AI_IMAGE_PROMPT_REJECTED",
              messages: ["rejected by content moderation"],
            },
          ],
        },
      },
    ],
  })

beforeEach(() => {
  h.enhanceShots.mockReset()
  h.cancel.mockReset().mockResolvedValue({})
  h.query.mockReset()
})

describe("useEnhanceFile — caption", () => {
  it("sends the caption on the run", async () => {
    h.enhanceShots.mockResolvedValue(answered(done("gen-1", "social")))
    const { result } = renderHook(() => useEnhanceFile())

    await act(() =>
      result.current.enhance(
        file,
        ["social"],
        {},
        undefined,
        undefined,
        "خصم 30%",
      ),
    )

    expect(inputOf(0).caption).toBe("خصم 30%")
    expect(inputOf(0).shots).toEqual(["social"])
  })

  it("sends null when the run carries none", async () => {
    h.enhanceShots.mockResolvedValue(answered(done("gen-1", "enhance")))
    const { result } = renderHook(() => useEnhanceFile())

    await act(() => result.current.enhance(file, ["enhance"], {}))

    expect(inputOf(0).caption).toBeNull()
  })

  it("re-rolls a node with the live run's caption", async () => {
    h.enhanceShots
      .mockResolvedValueOnce(answered(done("gen-1", "social")))
      .mockResolvedValueOnce(answered(done("gen-2", "social")))
    const { result } = renderHook(() => useEnhanceFile())

    await act(() =>
      result.current.enhance(file, ["social"], {}, undefined, undefined, "تسوق الآن"),
    )
    const node = result.current.outcome!.runs[0]
    await act(() => result.current.rerunShot(node))

    // A re-rolled social post that came back without its words would not be
    // a comparable result.
    expect(inputOf(1).caption).toBe("تسوق الآن")
  })

  it("names the caption when the moderator refuses it", async () => {
    h.enhanceShots.mockRejectedValue(refused("caption"))
    const { result } = renderHook(() => useEnhanceFile())

    await act(() =>
      result.current.enhance(file, ["social"], {}, undefined, undefined, "x"),
    )

    expect(result.current.state).toBe("error")
    expect(result.current.error).toBe("run.captionRejected")
  })

  // Same code, different field: only the caption gets the caption sentence.
  it("keeps the shared copy for a refusal about another field", async () => {
    h.enhanceShots.mockRejectedValue(refused("customScene"))
    const { result } = renderHook(() => useEnhanceFile())

    await act(() => result.current.enhance(file, ["enhance"], {}))

    expect(result.current.error).toBe("run.submitFailed")
  })

  /**
   * A restored run re-rolls each node on its own recorded terms. For the
   * caption that includes "none": a node that was never lettered must not pick
   * up a caption from some other run still held in memory.
   */
  it("re-rolls a restored node with its own recorded caption, including none", async () => {
    h.query.mockResolvedValue({
      data: {
        enhanceRun: {
          success: true,
          data: [
            {
              ...done("gen-e", "enhance"),
              params: { enhance: { style: "studio" } },
              reference_attachment_id: "att-1",
            },
            {
              ...done("gen-s", "social"),
              params: {
                enhance: { socialDesign: "duotone" },
                caption: { text: "تسوق الآن", position: "top" },
              },
              reference_attachment_id: "att-1",
            },
          ],
        },
      },
    })
    h.enhanceShots.mockImplementation(async () =>
      answered(done(`gen-${h.enhanceShots.mock.calls.length}`, "x")),
    )
    const { result } = renderHook(() => useEnhanceFile())

    await act(() => result.current.restore("run-1", [file]))
    const [enhanceNode, socialNode] = result.current.outcome!.runs

    await act(() => result.current.rerunShot(socialNode))
    expect(inputOf(0).caption).toBe("تسوق الآن")

    await act(() => result.current.rerunShot(enhanceNode))
    expect(inputOf(1).caption).toBeNull()
  })

  // The re-rolled node replaces the restored one, so it has to inherit the
  // recorded terms — or a second re-roll falls back to a live run that a
  // restored review does not have.
  it("keeps a restored node's caption across repeated re-rolls", async () => {
    h.query.mockResolvedValue({
      data: {
        enhanceRun: {
          success: true,
          data: [
            {
              ...done("gen-s", "social"),
              params: {
                enhance: { socialDesign: "duotone" },
                caption: { text: "تسوق الآن", position: "top" },
              },
              reference_attachment_id: "att-1",
            },
          ],
        },
      },
    })
    h.enhanceShots.mockImplementation(async () =>
      answered(done(`gen-${h.enhanceShots.mock.calls.length}`, "social")),
    )
    const { result } = renderHook(() => useEnhanceFile())

    await act(() => result.current.restore("run-1", [file]))
    await act(() => result.current.rerunShot(result.current.outcome!.runs[0]))
    await act(() => result.current.rerunShot(result.current.outcome!.runs[0]))

    expect(inputOf(1).caption).toBe("تسوق الآن")
    expect(inputOf(1).options).toEqual({ socialDesign: "duotone" })
  })
})

describe("recordedCaption", () => {
  it("reads both shapes the server writes", () => {
    expect(recordedCaption({ caption: "خصم" })).toBe("خصم")
    expect(recordedCaption({ caption: { text: "خصم" } })).toBe("خصم")
  })

  it("treats anything else as no caption", () => {
    expect(recordedCaption(null)).toBeNull()
    expect(recordedCaption({ enhance: {} })).toBeNull()
    expect(recordedCaption({ caption: "" })).toBeNull()
    expect(recordedCaption({ caption: {} })).toBeNull()
  })
})
