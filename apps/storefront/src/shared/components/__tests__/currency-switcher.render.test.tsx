import { describe, expect, it, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"
import { CurrencyProvider } from "@/shared/lib/currency/use-currency"
import { MULTI_CURRENCY_ENABLED } from "@/shared/lib/currency/currency-presets"
import { CurrencySwitcher } from "../currency-switcher"

function renderWithProviders(ui: React.ReactElement, { baseCurrency = "SAR" } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CurrencyProvider baseCurrency={baseCurrency}>
        {ui}
      </CurrencyProvider>
    </NextIntlClientProvider>,
  )
}

/**
 * The shipped state: the platform trades in SAR alone, so the control is absent
 * from the tree rather than hidden — no trigger, no popover, nothing to tab to.
 */
describe.runIf(!MULTI_CURRENCY_ENABLED)("CurrencySwitcher (single currency)", () => {
  it("renders nothing in either variant", () => {
    const { container: dropdown } = renderWithProviders(
      <CurrencySwitcher variant="dropdown" />,
    )
    expect(dropdown.innerHTML).toBe("")

    const { container: compact } = renderWithProviders(
      <CurrencySwitcher variant="compact" />,
    )
    expect(compact.innerHTML).toBe("")
    expect(screen.queryByRole("button", { name: /display currency/i })).toBeNull()
  })
})

/**
 * Kept, not deleted: these run again the moment `MULTI_CURRENCY_ENABLED` flips,
 * which is the whole point of switching the feature off with a flag.
 */
describe.skipIf(!MULTI_CURRENCY_ENABLED)("CurrencySwitcher", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("renders dropdown variant with active currency code and symbol", () => {
    renderWithProviders(<CurrencySwitcher variant="dropdown" />)

    const trigger = screen.getByRole("button", { name: /display currency/i })
    expect(trigger).toBeDefined()
    expect(trigger.textContent).toContain("SAR")
  })

  it("renders compact variant with label and code", () => {
    renderWithProviders(<CurrencySwitcher variant="compact" />)

    const trigger = screen.getByRole("button", { name: /display currency/i })
    expect(trigger).toBeDefined()
    expect(trigger.textContent).toContain("Display currency")
    expect(trigger.textContent).toContain("SAR")
  })

  it("opens popover with available currency presets upon click", () => {
    renderWithProviders(<CurrencySwitcher variant="dropdown" />)

    const trigger = screen.getByRole("button", { name: /display currency/i })
    fireEvent.click(trigger)

    expect(screen.getByRole("radiogroup", { name: /display currency/i })).toBeDefined()
    expect(screen.getByRole("radio", { name: /usd/i })).toBeDefined()
    expect(screen.getByRole("radio", { name: /eur/i })).toBeDefined()
    expect(screen.getByRole("radio", { name: /aed/i })).toBeDefined()
    expect(screen.getByRole("radio", { name: /kwd/i })).toBeDefined()
  })

  it("switches display currency when clicking a preset option", () => {
    renderWithProviders(<CurrencySwitcher variant="dropdown" />)

    const trigger = screen.getByRole("button", { name: /display currency/i })
    fireEvent.click(trigger)

    const usdOption = screen.getByRole("radio", { name: /usd/i })
    fireEvent.click(usdOption)

    // Trigger should now show USD
    expect(trigger.textContent).toContain("USD")
    expect(localStorage.getItem("zaydak_display_currency")).toBe("USD")
  })
})
