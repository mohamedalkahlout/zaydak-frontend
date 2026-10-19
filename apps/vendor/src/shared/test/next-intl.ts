import { vi } from "vitest"
// next-intl's own core, imported under its real name on purpose. This file is
// what `vi.mock("next-intl", ...)` factories import, so a static import of
// "next-intl" here resolves to the mock that factory is still building: the
// worker deadlocks and dies ~2 minutes later with "Worker exited unexpectedly",
// which reads like machine load rather than a cycle.
import { createTranslator } from "use-intl/core"
import en from "@/shared/messages/en"

type NextIntl = typeof import("next-intl")

/**
 * A `vi.mock("next-intl", ...)` factory that translates for real.
 *
 * Every other next-intl mock in this app echoes the key back (`useTranslations:
 * () => (key) => key`), which is fine for a component whose test only checks
 * that *something* rendered. It is useless for the ones that assert on the copy
 * a merchant actually reads — and those are the tests worth keeping, because a
 * key echo passes just as happily when the key is missing from `en.json`.
 *
 * So this builds a translator over the real English catalogue with next-intl's
 * own `createTranslator`, the same machinery `useTranslations` uses at runtime.
 * ICU plurals, `{placeholders}` and `t.rich` all behave as they do in the app,
 * and a key that is not in `en.json` fails the assertion instead of quietly
 * satisfying it.
 *
 * Usage — the factory must be invoked *inside* the `vi.mock` call, because
 * `vi.mock` is hoisted above the file's imports and a top-level import of this
 * helper would not exist yet when it runs:
 *
 * ```ts
 * vi.mock("next-intl", async () =>
 *   (await import("@/shared/test/next-intl")).nextIntlMock(),
 * )
 * ```
 */
export async function nextIntlMock(): Promise<NextIntl> {
  // `importActual` rather than a static import: mocking a module you also
  // import statically is how a mock ends up recursing into itself.
  const actual = await vi.importActual<NextIntl>("next-intl")

  return {
    ...actual,
    useTranslations: ((namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as Parameters<
          typeof actual.createTranslator
        >[0]["messages"],
        namespace: namespace as never,
      })) as NextIntl["useTranslations"],
    useLocale: (() => "en") as NextIntl["useLocale"],
    useFormatter: (() => ({
      relativeTime: () => "just now",
      dateTime: () => "Jan 1, 2026",
      number: (n: number) => String(n),
    })) as unknown as NextIntl["useFormatter"],
    useNow: (() => new Date("2026-09-05T00:00:00.000Z")) as unknown as NextIntl["useNow"],
  }
}

/**
 * A translator over the real English catalogue, for code that takes `t` as an
 * argument rather than calling `useTranslations` — a zod schema factory, a
 * column builder. Imported statically, unlike `nextIntlMock`, because nothing
 * here is hoisted.
 *
 * ```ts
 * const schema = loginSchema(enTranslator("auth.validation"))
 * ```
 */
export function enTranslator(namespace?: string) {
  return createTranslator({
    locale: "en",
    messages: en as Parameters<typeof createTranslator>[0]["messages"],
    namespace: namespace as never,
  }) as unknown as (key: string, values?: Record<string, unknown>) => string
}
