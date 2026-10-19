import { describe, expect, it } from "vitest"

import { buildSubscribeMailto } from "../newsletter"

/**
 * Every input to this function is untrusted or unbounded — a vendor-entered
 * settings field, a vendor-entered shop name, and whatever a visitor typed into
 * the footer's field — and the failure mode of getting the escaping wrong is
 * silent: the mail client opens, the message just has the wrong subject, or
 * half a body, or the wrong recipient.
 */
describe("buildSubscribeMailto", () => {
  const base = {
    contact: "hello@acme.test",
    subject: "Newsletter signup - Acme",
    body: "Please add me@example.test to your newsletter.",
  }

  it("addresses the shop's contact", () => {
    expect(buildSubscribeMailto(base).startsWith("mailto:hello@acme.test?")).toBe(
      true,
    )
  })

  it("keeps the @ in the address", () => {
    // `@` belongs to the addr-spec's own syntax (RFC 6068 §2). Percent-encoding
    // it gives some clients an address they cannot parse.
    expect(buildSubscribeMailto(base)).not.toContain("%40acme.test")
  })

  it("percent-encodes spaces rather than turning them into plus signs", () => {
    // `URLSearchParams` writes `+` for a space, which is right for a form post
    // and shows up literally in a mail client's subject line.
    const url = buildSubscribeMailto(base)
    expect(url).toContain("subject=Newsletter%20signup")
    expect(url).not.toContain("+")
  })

  it("survives an ampersand in the shop name", () => {
    // Unescaped, this would end the subject early and swallow the body.
    const url = buildSubscribeMailto({
      ...base,
      subject: "Signup - Bolt & Rivet",
    })
    expect(url).toContain("Bolt%20%26%20Rivet")
    expect(url).toContain("&body=")
    expect(url.match(/&body=/g)).toHaveLength(1)
  })

  it("survives a newline in the body", () => {
    const url = buildSubscribeMailto({ ...base, body: "line one\nline two" })
    expect(url).toContain("line%20one%0Aline%20two")
    expect(url).not.toContain("\n")
  })

  it("refuses to let a malformed contact start the query early", () => {
    // Nothing validates `settings.contact` as an email on the way here.
    const url = buildSubscribeMailto({ ...base, contact: "evil?subject=hi" })
    expect(url).toContain("mailto:evil%3Fsubject%3Dhi?")
    expect(url.match(/\?/g)).toHaveLength(1)
  })

  it("trims a padded address", () => {
    expect(
      buildSubscribeMailto({ ...base, contact: "  hello@acme.test  " }),
    ).toContain("mailto:hello@acme.test?")
  })
})
