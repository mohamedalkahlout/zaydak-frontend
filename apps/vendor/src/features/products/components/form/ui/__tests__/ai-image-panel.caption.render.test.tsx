import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"

/**
 * The product form's AI panel takes a line of text to print on the images.
 *
 * It goes on the mutation beside the prompt, never into it (the image model
 * cannot letter Arabic, so the server draws it afterwards), only from a mode
 * that makes a new picture, and a refusal of it says it was the text.
 */

const h = vi.hoisted(() => ({
  generate: vi.fn(),
  select: vi.fn(),
  query: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ query: h.query }),
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => [
    doc?.definitions?.find((d) => d.name?.value)?.name?.value ===
    "SelectAiImageResults"
      ? h.select
      : h.generate,
  ],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@/features/plan/lib/use-feature", () => ({
  useAiImageQuota: () => ({ remaining: null }),
}))

const { AiImagePanel } = await import("../ai-image-panel")

const done = {
  data: {
    generateProductImage: {
      success: true,
      data: {
        id: "gen-1",
        status: "SUCCEEDED",
        mode: "TEXT_TO_IMAGE",
        model: "flux",
        prompt: "a mug",
        cost_cents: 4,
        error: null,
        shot: null,
        created_at: "2026-09-28T00:00:00Z",
        results: [
          {
            id: "res-1",
            attachment_id: "att-1",
            url: "https://cdn/1.png",
            thumbnail: null,
            selected: false,
          },
        ],
      },
    },
  },
}

function renderPanel() {
  return render(
    <AiImagePanel
      open
      onOpenChange={() => {}}
      onAdd={() => {}}
      referenceOptions={[{ id: "ref-1", thumbnail: "https://cdn/ref.png" }]}
      productId="prod-1"
    />,
  )
}

const inputOf = () =>
  h.generate.mock.calls[0][0].variables.input as Record<string, unknown>

beforeEach(() => {
  h.generate.mockReset().mockResolvedValue(done)
  h.select.mockReset().mockResolvedValue({})
  h.query.mockReset()
})

describe("AiImagePanel — text on the image", () => {
  it("sends the caption beside the prompt", async () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText("Describe the image"), {
      target: { value: "a mug on a desk" },
    })
    fireEvent.change(screen.getByLabelText("Text on the image (optional)"), {
      target: { value: "  خصم 20% هذا الأسبوع  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await vi.waitFor(() => expect(h.generate).toHaveBeenCalledTimes(1))
    expect(inputOf()).toMatchObject({
      prompt: "a mug on a desk",
      caption: "خصم 20% هذا الأسبوع",
      productId: "prod-1",
    })
  })

  it("sends no caption when the field is blank", async () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText("Describe the image"), {
      target: { value: "a mug on a desk" },
    })
    fireEvent.change(screen.getByLabelText("Text on the image (optional)"), {
      target: { value: "   " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await vi.waitFor(() => expect(h.generate).toHaveBeenCalledTimes(1))
    expect(inputOf().caption).toBeUndefined()
  })

  // A cut-out or an upscale is a transform of an image the vendor already
  // has; text drawn across it would spoil the one thing it was asked for.
  it("hides the field for a background removal and sends nothing from it", async () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText("Text on the image (optional)"), {
      target: { value: "Sale" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Remove background" }))
    expect(screen.queryByLabelText("Text on the image (optional)")).toBeNull()

    fireEvent.change(screen.getByLabelText("Describe the image"), {
      target: { value: "the mug" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    await vi.waitFor(() => expect(h.generate).toHaveBeenCalledTimes(1))
    expect(inputOf()).toMatchObject({
      mode: "BACKGROUND_REMOVE",
      referenceAttachmentIds: ["ref-1"],
    })
    expect(inputOf().caption).toBeUndefined()
  })

  it("says it was the text when the safety filter refuses the caption", async () => {
    h.generate.mockReset().mockRejectedValue(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: "Validation failed",
            extensions: {
              error_code: "VALIDATION_ERROR",
              validation_errors: [
                {
                  field: "caption",
                  code: "AI_IMAGE_PROMPT_REJECTED",
                  messages: ["rejected by content moderation"],
                },
              ],
            },
          },
        ],
      }),
    )
    renderPanel()
    fireEvent.change(screen.getByLabelText("Describe the image"), {
      target: { value: "a mug on a desk" },
    })
    fireEvent.change(screen.getByLabelText("Text on the image (optional)"), {
      target: { value: "something refused" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))

    expect(
      await screen.findByText(
        "Your text was blocked by the safety filter. Change it and try again.",
      ),
    ).toBeTruthy()
  })
})
