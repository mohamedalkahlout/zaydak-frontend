import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useThemeEditorStore } from "../../state/theme-editor-store"
import { TemplatePreviewFrame } from "../preview/template-preview-frame"

vi.mock("next-intl", async () => (await import("@/shared/test/next-intl")).nextIntlMock())

describe("TemplatePreviewFrame", () => {
  beforeEach(() => {
    useThemeEditorStore.setState({ previewDevice: "desktop" })
  })

  it("frames the chosen template's preview route", () => {
    render(<TemplatePreviewFrame templateId="doughn" />)
    const frame = screen.getByTitle("Doughn preview")
    expect(frame.tagName).toBe("IFRAME")
    expect(frame.getAttribute("src")).toBe("/theme-preview/doughn")
  })

  it("narrows the frame to the selected device", () => {
    useThemeEditorStore.setState({ previewDevice: "mobile" })
    render(<TemplatePreviewFrame templateId="doughn" />)
    expect(screen.getByTitle("Doughn preview").style.maxWidth).toBe("390px")
  })
})
