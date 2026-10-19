import type {
  IntegrationConfigsQuery,
  IntegrationProvidersQuery,
  IntegrationStatusQuery,
} from "@/shared/api/generated/graphql"

/**
 * One provider the back-end knows how to talk to, with the fields it needs.
 * The form is built entirely from this — see `integration-settings.tsx`.
 */
export type ProviderSpec = NonNullable<
  IntegrationProvidersQuery["integrationProviders"]["data"]
>[number]

export type ProviderFieldSpec = ProviderSpec["fields"][number]

/** One stored config, credentials already masked by the server. */
export type IntegrationRow = NonNullable<
  IntegrationConfigsQuery["integrationConfigs"]["data"]
>[number]

/** What one integration type is actually using right now. */
export type IntegrationStatusRow = NonNullable<
  IntegrationStatusQuery["integrationStatus"]["data"]
>[number]

/** The form's working copy: one string per field, exactly what the inputs hold. */
export type CredentialDraft = Record<string, string>

/**
 * The provider slug that means "switched off". Mirrors `AI_MEDIA_OFF_PROVIDER`
 * in the back-end registry.
 *
 * It is a provider and not a flag for a reason worth knowing before touching
 * the switch: the back-end falls back to `.env` whenever **no row is enabled**,
 * so simply disabling the Replicate row would hand generation back to
 * `REPLICATE_API_TOKEN` while this screen showed it as off. Enabling a provider
 * that holds no credentials is still an enabled row, so the fallback never runs.
 */
export const OFF_PROVIDER = "off"

/**
 * Whether this type can be switched off from the console.
 *
 * True only when the server ships an `off` provider for it — the switch is
 * rendered from the catalog like everything else here, so a second type gaining
 * a kill switch costs this app nothing.
 */
export function offSpecOf(specs: ProviderSpec[]): ProviderSpec | undefined {
  return specs.find((s) => s.provider === OFF_PROVIDER)
}

/**
 * Whether a test send needs somewhere to send to.
 *
 * SMS and email address a person, so the dialog asks for one. Error monitoring
 * addresses the project its DSN already names, so asking would be asking the
 * admin to invent a value — the dialog drops the field and the mutation omits
 * it. Mirrors `testNeedsDestination` in the back-end registry, which is what
 * actually enforces it; this only decides what the dialog renders.
 */
export function testNeedsDestination(type: string): boolean {
  return type === "SMS" || type === "EMAIL"
}

/**
 * Whether this type has a test send at all.
 *
 * AI media does not. The cheapest thing a generation provider can be asked to
 * do still starts a billable prediction, so a "Send test" button here would
 * spend money on every press — and take tens of seconds to say anything. The
 * back-end refuses it (`supportsTestSend` in the provider registry); this is
 * what stops the console from offering a button that can only fail.
 *
 * WhatsApp does not either: a message can only leave through a shop's
 * connected instance, and this screen configures the shared server — there is
 * nothing to send from here. Verify carries the whole check.
 *
 * Shipping does not either, and here the reason is physical: the cheapest
 * thing a carrier aggregator can be asked to do is book a shipment, which
 * schedules a real courier against a real address and bills the platform for
 * it. There is no test parcel. Verify — the free token exchange — proves the
 * credential on its own.
 *
 * Scraping does not either, and it is AI media's case again: the cheapest
 * thing an extraction provider can be asked to do is fetch one page, which
 * consumes provider credit. Verify hits the free usage endpoint and proves the
 * account, so the only thing a test send would add is the part that costs
 * money.
 *
 * Storage does not either: the only thing a test could add over Verify is
 * writing an object, which would leave a stray file in the platform's zone on
 * every press. Verify lists the zone root for free and proves the password,
 * the zone and the region together.
 */
export function supportsTestSend(type: string): boolean {
  return (
    type !== "AI_MEDIA" &&
    type !== "WHATSAPP" &&
    type !== "TELEGRAM" &&
    type !== "SHIPPING" &&
    type !== "SCRAPING" &&
    type !== "STORAGE" &&
    type !== "INSTAGRAM"
  )
}

/**
 * Whether this type offers "Sync webhooks".
 *
 * WhatsApp alone, because it is the only integration whose callers are
 * registered one at a time, per shop, at pairing — every other receiver here
 * is one URL the provider was told about once. Changing the origin therefore
 * leaves already-connected shops posting nowhere (or at the old URL), and
 * nothing about saving this form reaches them.
 */
export function supportsWebhookSync(type: string): boolean {
  return type === "WHATSAPP"
}

/** Which `test.body*` string explains what pressing Send will do. */
export function testBodyKey(type: string): string {
  if (type === "SMS") return "bodySms"
  if (type === "EMAIL") return "bodyEmail"
  if (type === "AI_CHAT") return "bodyAiChat"
  return "bodyMonitoring"
}

/**
 * What the dialog is called, and what the toast says once it has gone through.
 *
 * Both used to be a single either/or on `testNeedsDestination`: a test that
 * names a recipient said "message", and everything else borrowed monitoring's
 * words. AI chat has no recipient either, so it inherited "Send a test event"
 * and then "check the project's Issues feed" — a Sentry sentence under a Groq
 * completion. Keyed on the type, each says what actually happened.
 */
export function testTitleKey(type: string): string {
  if (type === "AI_CHAT") return "test.titleAiChat"
  return testNeedsDestination(type) ? "test.title" : "test.titleMonitoring"
}

/** The success line for a test with no destination to name back. */
export function testDoneKey(type: string): string {
  return type === "AI_CHAT" ? "test.doneAiChat" : "testEventSent"
}

/** The error codes `integrationStatus` reports as `unusable_reason`. */
const UNUSABLE_REASONS = new Set([
  "DECRYPTION_FAILED",
  "ENCRYPTION_KEY_MISSING",
  "UNKNOWN_INTEGRATION_PROVIDER",
])

/**
 * Why an enabled row cannot be used, as a message key. The server sends an
 * error code, and the three it sends today need three different fixes —
 * re-enter the credentials, set the server's encryption key, or pick a
 * provider this build ships. A code the back-end adds before this list learns
 * it still gets a sentence rather than a raw key.
 */
export function unusableReasonKey(code: string | null | undefined): string {
  return code && UNUSABLE_REASONS.has(code)
    ? `unusable.reason.${code}`
    : "unusable.reason.other"
}

/** The codes `integrationStatus` reports as `not_in_use_reason`. */
const NOT_IN_USE_REASONS = new Set([
  "STORAGE_DRIVER_LOCAL",
  "STORAGE_DRIVER_S3",
])

/**
 * Why a configuration the server resolves is not the one it runs on, as a
 * message key — today only Storage on a server whose `STORAGE_DRIVER` is not
 * `bunnycdn`. A code this list has not learned still gets a sentence.
 */
export function notInUseReasonKey(code: string | null | undefined): string {
  return code && NOT_IN_USE_REASONS.has(code)
    ? `notInUse.reason.${code}`
    : "notInUse.reason.other"
}

/**
 * Build the draft for a provider, from whatever is stored.
 *
 * **Secret fields are seeded with the server's mask** (`••••1234`), not with the
 * secret — the server has never sent one and never will. The mask is there so
 * the screen reads honestly at a glance: a filled field means something is
 * configured, an empty one means nothing is.
 *
 * That makes the mask indistinguishable from a real value to this code, which
 * is why what gets submitted is decided by `touched` rather than by comparing
 * strings. Nothing here can accidentally post a row of dots as a credential.
 */
export function draftFor(
  spec: ProviderSpec,
  row: IntegrationRow | undefined,
): CredentialDraft {
  const stored = new Map(row?.values.map((v) => [v.key, v.value]) ?? [])
  const draft: CredentialDraft = {}
  for (const field of spec.fields) {
    draft[field.key] = stored.get(field.key) ?? defaultFor(field)
  }
  return draft
}

/** A new provider's starting value: the first option for a select, else empty. */
function defaultFor(field: ProviderFieldSpec): string {
  if (field.input_type === "select") return field.options[0]?.value ?? ""
  if (field.input_type === "boolean") return "false"
  return ""
}

/**
 * Turn a draft into the `credentials` payload.
 *
 * A secret the admin did not edit is **omitted**, which the server reads as
 * "keep the stored one". This is what lets someone change an SMTP port without
 * re-typing the password — and it is keyed on `touched`, so the mask sitting in
 * the input is never mistaken for something worth sending.
 */
export function toCredentials(
  spec: ProviderSpec,
  draft: CredentialDraft,
  touched: ReadonlySet<string>,
): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {}
  for (const field of spec.fields) {
    const raw = draft[field.key] ?? ""
    if (field.secret && !touched.has(field.key)) continue
    payload[field.key] =
      field.input_type === "boolean" ? raw === "true" : raw
  }
  return payload
}

/**
 * Whether the draft can be submitted.
 *
 * A required secret counts as satisfied whenever the input holds anything —
 * including the stored mask, which stands for a credential that already exists.
 * Without that the form would refuse to save a changed sender address until the
 * admin also re-typed an API key they cannot see.
 */
export function isDraftComplete(
  spec: ProviderSpec,
  draft: CredentialDraft,
): boolean {
  return spec.fields.every(
    (field) => !field.required || (draft[field.key] ?? "").trim() !== "",
  )
}
