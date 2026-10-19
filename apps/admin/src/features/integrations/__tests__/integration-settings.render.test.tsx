import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "@/shared/messages/en.json"
import {
  IntegrationSource,
  IntegrationType,
} from "@/shared/api/generated/graphql"
import { IntegrationSettings } from "../components/integration-settings"
import type { IntegrationRow, IntegrationStatusRow, ProviderSpec } from "../types"

/**
 * The status banner's answer for a row that is saved, enabled and unreadable.
 *
 * It used to read "nothing configured" — the same words as a type nobody has
 * touched — on the screen an admin opens to find out why every upload fails.
 */

let status: IntegrationStatusRow

const bunnySpec: ProviderSpec = {
  __typename: "IntegrationProviderEntry",
  type: IntegrationType.Storage,
  provider: "bunnycdn",
  name: "Bunny Storage",
  name_ar: "Bunny Storage",
  description: "The storage zone every upload is written to.",
  description_ar: "منطقة التخزين.",
  is_dev_sink: false,
  fields: [
    {
      __typename: "IntegrationFieldEntry",
      key: "storage_zone",
      label: "Storage zone",
      label_ar: "منطقة التخزين",
      input_type: "text",
      required: true,
      secret: false,
      placeholder: null,
      help: null,
      help_ar: null,
      options: [],
    },
  ],
}

const smtpSpec: ProviderSpec = {
  ...bunnySpec,
  type: IntegrationType.Email,
  provider: "smtp",
  name: "SMTP",
  name_ar: "SMTP",
}

/** A row whose credentials will not decrypt: listed, with every value empty. */
const unreadableRow = (spec: ProviderSpec): IntegrationRow => ({
  __typename: "IntegrationEntry",
  id: `cfg_${spec.provider}`,
  type: spec.type,
  provider: spec.provider,
  is_enabled: true,
  last_verified_at: null,
  last_verify_error: null,
  updated_at: "2026-09-25T00:00:00.000Z",
  values: [
    {
      __typename: "IntegrationValueEntry",
      key: "storage_zone",
      value: "",
      is_secret: false,
    },
  ],
})

const statusRow = (
  over: Partial<IntegrationStatusRow>,
): IntegrationStatusRow => ({
  __typename: "IntegrationStatusEntry",
  type: IntegrationType.Storage,
  provider: null,
  source: IntegrationSource.None,
  is_dev_sink: false,
  unusable_reason: null,
  not_in_use_reason: null,
  ...over,
})

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    const refetch = vi.fn()
    if (name === "IntegrationProviders")
      return {
        data: {
          integrationProviders: { success: true, data: [bunnySpec, smtpSpec] },
        },
        loading: false,
        refetch,
      }
    if (name === "IntegrationConfigs")
      return {
        data: {
          integrationConfigs: {
            success: true,
            data: [unreadableRow(bunnySpec), unreadableRow(smtpSpec)],
          },
        },
        loading: false,
        refetch,
      }
    if (name === "IntegrationStatus")
      return {
        data: { integrationStatus: { success: true, data: [status] } },
        loading: false,
        refetch,
      }
    return { data: undefined, loading: false, refetch }
  },
  useMutation: () => [vi.fn(), { loading: false }],
}))

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as never,
        namespace: namespace as never,
      }),
    useLocale: () => "en",
  }
})

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const m = en.integrations

beforeEach(() => {
  status = statusRow({})
})

afterEach(cleanup)

describe("IntegrationSettings status banner", () => {
  it("names an unreadable STORAGE row, why, and what it does to uploads", () => {
    status = statusRow({
      provider: "bunnycdn",
      source: IntegrationSource.Unusable,
      unusable_reason: "DECRYPTION_FAILED",
    })
    render(<IntegrationSettings type={IntegrationType.Storage} />)

    const banner = screen.getByRole("alert")
    expect(banner.textContent).toContain(
      m.unusable.title.replace("{provider}", "bunnycdn"),
    )
    expect(banner.textContent).toContain(m.unusable.reason.DECRYPTION_FAILED)
    expect(banner.textContent).toContain(m.unusable.consequenceStorage)
    // The old reading, which sent the admin looking for a form never filled in.
    expect(screen.queryByText(m.source.NONE)).toBeNull()
    // The broken row is the enabled one, so the primary Save re-applies it —
    // there is nothing to "save without switching" away from.
    expect(screen.queryByText(m.saveWithoutSwitching)).toBeNull()
  })

  it("gives a retired provider its own fix", () => {
    status = statusRow({
      provider: "retired-storage",
      source: IntegrationSource.Unusable,
      unusable_reason: "UNKNOWN_INTEGRATION_PROVIDER",
    })
    render(<IntegrationSettings type={IntegrationType.Storage} />)

    expect(screen.getByRole("alert").textContent).toContain(
      m.unusable.reason.UNKNOWN_INTEGRATION_PROVIDER,
    )
  })

  it("says why the saved row is not serving when the environment is", () => {
    status = statusRow({
      type: IntegrationType.Email,
      provider: "smtp",
      source: IntegrationSource.Environment,
      unusable_reason: "DECRYPTION_FAILED",
    })
    render(<IntegrationSettings type={IntegrationType.Email} />)

    // Both halves: what is serving, which is true, and why it is not the row.
    expect(screen.getByText(m.source.ENVIRONMENT)).toBeTruthy()
    expect(
      screen.getByText(
        `${m.unusable.fallback} ${m.unusable.reason.DECRYPTION_FAILED}`,
      ),
    ).toBeTruthy()
    expect(
      screen.queryByText(m.unusable.consequenceStorage, { exact: false }),
    ).toBeNull()
  })

  // A server storing uploads on its own disk reads no Bunny zone at all, and
  // this screen used to show the saved one as what was in use.
  it("says the server does not use Storage settings while it stores locally", () => {
    status = statusRow({
      provider: "bunnycdn",
      source: IntegrationSource.Database,
      not_in_use_reason: "STORAGE_DRIVER_LOCAL",
    })
    render(<IntegrationSettings type={IntegrationType.Storage} />)

    const banner = screen.getByRole("status")
    expect(banner.textContent).toContain(m.notInUse.title)
    expect(banner.textContent).toContain(
      m.notInUse.reason.STORAGE_DRIVER_LOCAL,
    )
    // Not the "sending through bunnycdn" headline it used to show.
    expect(screen.queryByText(m.activeNow)).toBeNull()
  })

  it("says so instead of paging about a dead row no upload reads", () => {
    status = statusRow({
      provider: "bunnycdn",
      source: IntegrationSource.Unusable,
      unusable_reason: "DECRYPTION_FAILED",
      not_in_use_reason: "STORAGE_DRIVER_S3",
    })
    render(<IntegrationSettings type={IntegrationType.Storage} />)

    expect(screen.queryByRole("alert")).toBeNull()
    const banner = screen.getByRole("status")
    expect(banner.textContent).toContain(m.notInUse.reason.STORAGE_DRIVER_S3)
    // The fix is still named, for the day the server switches to Bunny.
    expect(banner.textContent).toContain(m.unusable.reason.DECRYPTION_FAILED)
    expect(banner.textContent).not.toContain(m.unusable.consequenceStorage)
  })

  it("still reads a type with nothing saved as nothing configured", () => {
    render(<IntegrationSettings type={IntegrationType.Storage} />)

    expect(screen.getAllByText(m.source.NONE).length).toBeGreaterThan(0)
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
