import { describe, expect, it } from "vitest"

import { OtpLogStatus, OtpPurpose } from "@/shared/api/generated/graphql"
import { toCsv } from "@/shared/lib/csv"
import { otpLogCsvRows, otpLogsFileName, type OtpLogCsvLabels } from "../export"
import type { OtpLogRow } from "../types"

const row = (over: Partial<OtpLogRow> = {}): OtpLogRow => ({
  __typename: "OtpLogEntry",
  id: "otp-1",
  identifier: "user@example.com",
  purpose: OtpPurpose.Login,
  status: OtpLogStatus.Verified,
  attempts: 0,
  max_attempts: 5,
  expires_at: "2026-08-03T10:05:00.000Z",
  verified_at: "2026-08-03T10:01:00.000Z",
  delivered_at: "2026-08-03T10:00:05.000Z",
  delivery_error: null,
  created_at: "2026-08-03T10:00:00.000Z",
  user_id: "user-1",
  user_name: "Test User",
  ...over,
})

/** Identity labels, so an assertion reads as the column it is about. */
const labels: OtpLogCsvLabels = {
  columns: {
    sent: "Sent",
    identifier: "Sent to",
    account: "Account",
    purpose: "Purpose",
    status: "Status",
    attempts: "Attempts",
    delivery: "Delivery",
    deliveryError: "Delivery error",
    verified: "Verified",
    expires: "Expires",
  },
  purpose: (p) => `purpose:${p}`,
  status: (s) => `status:${s}`,
  delivery: (state) => `delivery:${state}`,
  none: "—",
}

describe("otpLogCsvRows", () => {
  it("emits the columns in file order", () => {
    expect(Object.keys(otpLogCsvRows([row()], labels, "en")[0])).toEqual([
      "Sent",
      "Sent to",
      "Account",
      "Purpose",
      "Status",
      "Attempts",
      "Delivery",
      "Delivery error",
      "Verified",
      "Expires",
    ])
  })

  it("emits one row per log entry", () => {
    const rows = otpLogCsvRows(
      [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })],
      labels,
      "en",
    )
    expect(rows).toHaveLength(3)
  })

  it("exports localized labels, not the raw enum values", () => {
    // The file is opened by whoever was just looking at the screen; a column
    // reading RESET_PASSWORD next to one reading "Password reset" is a file
    // they have to translate back.
    const csv = otpLogCsvRows(
      [row({ purpose: OtpPurpose.ResetPassword, status: OtpLogStatus.Locked })],
      labels,
      "en",
    )[0]
    expect(csv.Purpose).toBe("purpose:RESET_PASSWORD")
    expect(csv.Status).toBe("status:LOCKED")
  })

  it("uses an em dash for a null account, verified time and delivery error", () => {
    const csv = otpLogCsvRows(
      [row({ user_name: null, verified_at: null })],
      labels,
      "en",
    )[0]
    expect(csv.Account).toBe("—")
    expect(csv.Verified).toBe("—")
    expect(csv["Delivery error"]).toBe("—")
  })

  it("reads delivery_error before delivered_at, as the table does", () => {
    const failed = otpLogCsvRows(
      [row({ delivery_error: "550 mailbox unavailable" })],
      labels,
      "en",
    )[0]
    expect(failed.Delivery).toBe("delivery:failed")
    expect(failed["Delivery error"]).toBe("550 mailbox unavailable")

    const queued = otpLogCsvRows([row({ delivered_at: null })], labels, "en")[0]
    expect(queued.Delivery).toBe("delivery:pending")
  })

  it("carries the row's own attempt budget", () => {
    expect(
      otpLogCsvRows([row({ attempts: 2, max_attempts: 5 })], labels, "en")[0]
        .Attempts,
    ).toBe("2 / 5")
  })

  it("survives serialization when a cell contains a comma", () => {
    // A gateway refusal is free text and routinely has one; unquoted it would
    // shift every column after it.
    const csv = toCsv(
      otpLogCsvRows(
        [row({ identifier: "Doe, John <j@example.com>" })],
        labels,
        "en",
      ),
    )
    expect(csv).toContain('"Doe, John <j@example.com>"')
    expect(csv.split("\r\n")).toHaveLength(2)
  })
})

describe("otpLogsFileName", () => {
  const now = new Date("2026-08-14T09:00:00.000Z")

  it("names both bounds when the range is closed", () => {
    expect(otpLogsFileName("2026-08-01", "2026-08-14", now)).toBe(
      "otp-logs-2026-08-01_2026-08-14.csv",
    )
  })

  it("names the single bound when the range is half-open", () => {
    expect(otpLogsFileName("2026-08-01", "", now)).toBe(
      "otp-logs-from-2026-08-01.csv",
    )
    expect(otpLogsFileName("", "2026-08-14", now)).toBe(
      "otp-logs-to-2026-08-14.csv",
    )
  })

  it("falls back to the day it was taken", () => {
    expect(otpLogsFileName("", "", now)).toBe("otp-logs-2026-08-14.csv")
  })
})
