import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"

import { applyZodLocale } from "@/shared/i18n/zod-locale"

const schema = z.object({
  uses: z.coerce.number().positive(),
  name: z.string().min(1, "custom"),
})

const messages = () =>
  schema.safeParse({ uses: -1, name: "" }).error!.issues.map((i) => i.message)

describe("applyZodLocale", () => {
  afterEach(() => applyZodLocale("en"))

  it("words zod's built-in messages in Arabic under an Arabic dashboard", () => {
    applyZodLocale("ar")
    const [uses] = messages()
    expect(uses).toMatch(/[؀-ۿ]/)
  })

  it("leaves a message the schema passes alone", () => {
    applyZodLocale("ar")
    expect(messages()[1]).toBe("custom")
  })

  it("goes back to English, and treats an unknown locale as the default", () => {
    applyZodLocale("ar")
    applyZodLocale("fr")
    expect(messages()[0]).toMatch(/^Too small/)
  })
})
