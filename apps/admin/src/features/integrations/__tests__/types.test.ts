import { describe, expect, it } from "vitest"
import {
  draftFor,
  isDraftComplete,
  offSpecOf,
  OFF_PROVIDER,
  supportsTestSend,
  supportsWebhookSync,
  testBodyKey,
  testNeedsDestination,
  toCredentials,
  unusableReasonKey,
  type IntegrationRow,
  type ProviderSpec,
} from "../types"

const field = (over: Partial<ProviderSpec["fields"][number]>) =>
  ({
    key: "k",
    label: "K",
    label_ar: "ك",
    input_type: "text",
    required: false,
    secret: false,
    placeholder: null,
    help: null,
    help_ar: null,
    options: [],
    ...over,
  }) as ProviderSpec["fields"][number]

const smtp = {
  type: "EMAIL",
  provider: "smtp",
  name: "SMTP",
  name_ar: "SMTP",
  description: "",
  description_ar: "",
  is_dev_sink: false,
  fields: [
    field({ key: "host", required: true }),
    field({ key: "port", input_type: "number", required: true }),
    field({
      key: "encryption",
      input_type: "select",
      options: [
        { value: "starttls", label: "STARTTLS", label_ar: "STARTTLS" },
        { value: "ssl", label: "SSL / TLS", label_ar: "SSL / TLS" },
      ],
    }),
    field({
      key: "password",
      input_type: "password",
      required: true,
      secret: true,
    }),
    field({ key: "from", required: true }),
  ],
} as unknown as ProviderSpec

const MASK = "••••cret"

const stored = {
  id: "cfg_1",
  type: "EMAIL",
  provider: "smtp",
  is_enabled: true,
  values: [
    { key: "host", value: "smtp.example.com", is_secret: false },
    { key: "port", value: "587", is_secret: false },
    { key: "encryption", value: "starttls", is_secret: false },
    { key: "password", value: MASK, is_secret: true },
    { key: "from", value: "hi@example.com", is_secret: false },
  ],
} as unknown as IntegrationRow

const none = new Set<string>()

describe("draftFor", () => {
  it("pre-fills stored values so they can be read and edited", () => {
    const draft = draftFor(smtp, stored)
    expect(draft.host).toBe("smtp.example.com")
    expect(draft.from).toBe("hi@example.com")
  })

  it("seeds a secret with the server's mask, never a secret", () => {
    // The mask is what makes "something is configured" visible at a glance.
    // The server has never sent the credential itself, so there is nothing
    // else it could hold.
    expect(draftFor(smtp, stored).password).toBe(MASK)
  })

  it("starts a select on its first option rather than empty", () => {
    expect(draftFor(smtp, undefined).encryption).toBe("starttls")
  })

  it("leaves text fields empty when nothing is stored", () => {
    const draft = draftFor(smtp, undefined)
    expect(draft.host).toBe("")
    expect(draft.password).toBe("")
  })
})

describe("toCredentials", () => {
  const draft = {
    host: "smtp.example.com",
    port: "587",
    encryption: "ssl",
    password: MASK,
    from: "hi@example.com",
  }

  it("omits an untouched secret, so the mask can never be submitted", () => {
    // The single most important assertion here: the input holds `••••cret`,
    // and posting that literal string would overwrite a working password with
    // four dots and four characters.
    const payload = toCredentials(smtp, draft, none)
    expect("password" in payload).toBe(false)
    expect(JSON.stringify(payload)).not.toContain("•")
  })

  it("sends a secret the admin actually typed", () => {
    const payload = toCredentials(
      smtp,
      { ...draft, password: "new-secret" },
      new Set(["password"]),
    )
    expect(payload.password).toBe("new-secret")
  })

  it("still omits a secret that was typed and then reverted by hand", () => {
    // `touched` is the signal, but an untouched field is the common case; this
    // pins that the mask is never sent even once editing has begun elsewhere.
    expect("password" in toCredentials(smtp, draft, new Set(["host"]))).toBe(
      false,
    )
  })

  it("sends non-secret fields whether or not they were touched", () => {
    const payload = toCredentials(smtp, draft, none)
    expect(payload.host).toBe("smtp.example.com")
    expect(payload.encryption).toBe("ssl")
  })

  it("keeps a cleared non-secret field, because clearing one is deliberate", () => {
    // Non-secret fields render filled in, so a blank one is an erasure the
    // admin actually performed — unlike a blank secret, which they never saw.
    expect(toCredentials(smtp, { ...draft, from: "" }, none).from).toBe("")
  })

  it("sends booleans as booleans, not as the string 'true'", () => {
    const withBool = {
      ...smtp,
      fields: [field({ key: "flag", input_type: "boolean" })],
    } as ProviderSpec
    expect(toCredentials(withBool, { flag: "true" }, none).flag).toBe(true)
    expect(toCredentials(withBool, { flag: "false" }, none).flag).toBe(false)
  })
})

describe("isDraftComplete", () => {
  it("accepts the stored mask as a satisfied required secret", () => {
    // Otherwise changing an SMTP port would demand re-typing the password.
    expect(isDraftComplete(smtp, draftFor(smtp, stored))).toBe(true)
  })

  it("refuses a required secret when nothing is stored or typed", () => {
    expect(isDraftComplete(smtp, draftFor(smtp, undefined))).toBe(false)
  })

  it("refuses a blank required non-secret", () => {
    expect(isDraftComplete(smtp, { ...draftFor(smtp, stored), host: "" })).toBe(
      false,
    )
  })

  it("ignores optional fields", () => {
    expect(
      isDraftComplete(smtp, { ...draftFor(smtp, stored), encryption: "" }),
    ).toBe(true)
  })
})

describe("test send shape", () => {
  it("asks for a destination only where there is somewhere to send", () => {
    expect(testNeedsDestination("SMS")).toBe(true)
    expect(testNeedsDestination("EMAIL")).toBe(true)
    // Monitoring addresses the project its DSN already names.
    expect(testNeedsDestination("MONITORING")).toBe(false)
  })

  it("explains what Send will actually do, per type", () => {
    expect(testBodyKey("SMS")).toBe("bodySms")
    expect(testBodyKey("EMAIL")).toBe("bodyEmail")
    expect(testBodyKey("MONITORING")).toBe("bodyMonitoring")
  })

  it("falls back to the destination-less copy for an unknown type", () => {
    // A type added on the back-end reaches this screen before it gets its own
    // strings. Defaulting to "needs a destination" would render a required
    // field the admin cannot fill; defaulting the other way just sends.
    expect(testNeedsDestination("STORAGE")).toBe(false)
    expect(testBodyKey("STORAGE")).toBe("bodyMonitoring")
  })
})

describe("webhook sync", () => {
  it("is offered for WhatsApp and nothing else", () => {
    expect(supportsWebhookSync("WHATSAPP")).toBe(true)
    // Every other receiver is one URL the provider was told about once, so
    // there is nothing per-shop to re-register and the button would be a
    // no-op the admin would reasonably expect to do something.
    expect(supportsWebhookSync("AI_MEDIA")).toBe(false)
    expect(supportsWebhookSync("SHIPPING")).toBe(false)
    expect(supportsWebhookSync("EMAIL")).toBe(false)
  })

  it("stays off for a type this screen has never heard of", () => {
    // A type added on the back-end reaches this screen before anyone decides
    // what it needs. Closed by default: the action reaches every live session
    // on a shared server, which is not a thing to opt a stranger into.
    expect(supportsWebhookSync("STORAGE")).toBe(false)
    expect(supportsWebhookSync("")).toBe(false)
  })
})

describe("the off switch", () => {
  const spec = (provider: string) =>
    ({
      type: "AI_MEDIA",
      provider,
      name: provider,
      name_ar: provider,
      description: "",
      description_ar: "",
      is_dev_sink: provider === OFF_PROVIDER,
      fields: [],
    }) as unknown as ProviderSpec

  it("finds the off provider when the server ships one", () => {
    const specs = [spec("replicate"), spec(OFF_PROVIDER)]
    expect(offSpecOf(specs)?.provider).toBe(OFF_PROVIDER)
  })

  it("finds nothing for a type that cannot be switched off", () => {
    // The switch is rendered from the catalog, so a type without an `off`
    // provider must render no control rather than one that does nothing.
    expect(offSpecOf([spec("twilio")])).toBeUndefined()
  })

  it("keeps the off provider out of the transport picker", () => {
    // Two controls for one decision is how a screen disagrees with itself:
    // the switch owns off, the picker owns which account is used.
    const specs = [spec("replicate"), spec(OFF_PROVIDER)]
    const selectable = specs.filter((s) => s.provider !== OFF_PROVIDER)
    expect(selectable.map((s) => s.provider)).toEqual(["replicate"])
  })

  it("submits nothing as credentials, because the off provider has no fields", () => {
    // The save that switches generation off carries an empty object; the
    // server's schema for this provider is `z.object({})`.
    expect(toCredentials(spec(OFF_PROVIDER), {}, new Set())).toEqual({})
  })

  it("is always submittable — no field can be missing", () => {
    expect(isDraftComplete(spec(OFF_PROVIDER), {})).toBe(true)
  })
})

describe("supportsTestSend", () => {
  it("hides the test send where a test would spend or has nothing to send from", () => {
    // AI media: its cheapest call is a billable prediction. WhatsApp: nothing
    // can be sent until a shop instance exists — the platform row stores none.
    // Verify covers the free half for both.
    expect(supportsTestSend("AI_MEDIA")).toBe(false)
    expect(supportsTestSend("WHATSAPP")).toBe(false)
    // Storage: a test could only write an object, leaving a stray file in the
    // platform's zone on every press. Verify lists the zone for free.
    expect(supportsTestSend("STORAGE")).toBe(false)
    expect(supportsTestSend("INSTAGRAM")).toBe(false)
    expect(supportsTestSend("SMS")).toBe(true)
    expect(supportsTestSend("EMAIL")).toBe(true)
    expect(supportsTestSend("MONITORING")).toBe(true)
  })
})

describe("unusableReasonKey", () => {
  it("gives each code the server sends its own fix", () => {
    expect(unusableReasonKey("DECRYPTION_FAILED")).toBe(
      "unusable.reason.DECRYPTION_FAILED",
    )
    expect(unusableReasonKey("ENCRYPTION_KEY_MISSING")).toBe(
      "unusable.reason.ENCRYPTION_KEY_MISSING",
    )
    expect(unusableReasonKey("UNKNOWN_INTEGRATION_PROVIDER")).toBe(
      "unusable.reason.UNKNOWN_INTEGRATION_PROVIDER",
    )
  })

  // A code the back-end adds first must still render a sentence, not a key.
  it("falls back to a generic sentence for a code it does not know", () => {
    expect(unusableReasonKey("SOMETHING_NEW")).toBe("unusable.reason.other")
    expect(unusableReasonKey(null)).toBe("unusable.reason.other")
  })
})
