import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { DomainSteps, type DomainStep } from "../domains/domain-steps"

/**
 * The setup of a domain as three steps.
 *
 * What is worth pinning is the vocabulary — each icon state draws a different
 * glyph, so "you have finished and the platform is working" is a different
 * picture from "something is wrong" — and the fold: content folds under a
 * step, but whatever is passed as `after` never does, because that is where
 * the verify button lives.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const step = (over: Partial<DomainStep> & { key: string }): DomainStep => ({
  icon: "pending",
  title: over.key,
  ...over,
})

function iconOf(key: string) {
  return document.querySelector(`li[data-step="${key}"] svg`)
}

describe("DomainSteps", () => {
  it("draws one glyph per state", () => {
    render(
      <DomainSteps
        steps={[
          step({ key: "a", icon: "done" }),
          step({ key: "b", icon: "error" }),
          step({ key: "c", icon: "progress" }),
          step({ key: "d", icon: "pending" }),
        ]}
      />,
    )
    expect(iconOf("a")?.getAttribute("class")).toContain("text-emerald-600")
    expect(iconOf("b")?.getAttribute("class")).toContain("text-destructive")
    expect(iconOf("c")?.getAttribute("class")).toContain("animate-spin")
    expect(iconOf("d")?.getAttribute("class")).toContain("text-muted-foreground")
  })

  it("marks the first unfinished step as the current one and mutes the pending ones after it", () => {
    render(
      <DomainSteps
        steps={[
          step({ key: "a", icon: "done" }),
          step({ key: "b", icon: "progress" }),
          step({ key: "c", icon: "pending" }),
        ]}
      />,
    )
    const current = document.querySelectorAll("li[aria-current='step']")
    expect(current).toHaveLength(1)
    expect(current[0].getAttribute("data-step")).toBe("b")
    expect(screen.getByText("c").className).toContain("text-muted-foreground")
    expect(screen.getByText("b").className).toContain("text-foreground")
  })

  it("shows a subtitle and an aside when given", () => {
    render(
      <DomainSteps
        steps={[
          step({
            key: "tls",
            icon: "progress",
            subtitle: "Requesting TLS certificate",
            aside: "Estimated: a few minutes",
          }),
        ]}
      />,
    )
    expect(screen.queryByText("Requesting TLS certificate")).not.toBeNull()
    expect(screen.queryByText("Estimated: a few minutes")).not.toBeNull()
  })

  it("folds content under a step and toggles it", () => {
    render(
      <DomainSteps
        steps={[
          step({
            key: "dns",
            content: <p>instructions</p>,
            defaultOpen: true,
            toggle: "panel",
          }),
        ]}
      />,
    )
    expect(screen.queryByText("instructions")).not.toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Hide details" }))
    expect(screen.queryByText("instructions")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Show details" }))
    expect(screen.queryByText("instructions")).not.toBeNull()
  })

  it("keeps a step's report folded by default", () => {
    render(
      <DomainSteps
        steps={[step({ key: "dns", icon: "done", content: <p>report</p> })]}
      />,
    )
    expect(screen.queryByText("report")).toBeNull()
    expect(screen.getByRole("button", { name: "Show details" })).toBeTruthy()
  })

  it("never folds what is passed as `after`", () => {
    // The verify button sits between the steps, outside the fold, so it
    // cannot disappear with a step that is already ticked.
    render(
      <DomainSteps
        steps={[
          step({
            key: "dns",
            icon: "done",
            content: <p>report</p>,
            after: <button type="button">I updated DNS records</button>,
          }),
          step({ key: "live" }),
        ]}
      />,
    )
    expect(screen.queryByText("report")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "I updated DNS records" }),
    ).not.toBeNull()
  })

  it("offers no toggle on a step with nothing to fold", () => {
    render(<DomainSteps steps={[step({ key: "a" })]} />)
    expect(screen.queryByRole("button")).toBeNull()
  })
})
