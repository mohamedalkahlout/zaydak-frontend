import { vi } from "vitest"
import en from "@/shared/messages/en"
import ar from "@/shared/messages/ar"

type NextIntl = typeof import("next-intl")
type Messages = Parameters<NextIntl["createTranslator"]>[0]["messages"]

export type TestLocale = "en" | "ar"

const CATALOGUES: Record<TestLocale, Messages> = {
  en: en as Messages,
  ar: ar as Messages,
}

const active: { locale: TestLocale } = { locale: "en" }

/**
 * Pick the language every `useTranslations` / `useLocale` in the test renders
 * in. Reset it in a `beforeEach`: the choice outlives the test that made it.
 */
export function setTestLocale(locale: TestLocale): void {
  active.locale = locale
}

/**
 * `@/shared/test/next-intl`'s `nextIntlMock`, but in either catalogue.
 *
 * Most of the assistant's copy used to be hand-rolled `isAr ? "…" : "…"`
 * ternaries, and several tests pinned the Arabic side by rendering with
 * `locale="ar"`. That copy now lives in `ar/aiChat.json`, so pinning it means
 * rendering against the real Arabic catalogue — the same `createTranslator`
 * next-intl uses at runtime, so plurals and `{placeholders}` behave as they do
 * in the app and a key missing from either file fails the assertion.
 *
 * ```ts
 * vi.mock("next-intl", async () =>
 *   (await import("@/features/ai/test-utils/next-intl")).bilingualNextIntlMock(),
 * )
 * import { setTestLocale } from "@/features/ai/test-utils/next-intl"
 * ```
 *
 * `next-intl` is reached only through `importActual`, never imported here, for
 * the reason the shared helper gives: this module is loaded from inside the
 * mock's own factory.
 */
export async function bilingualNextIntlMock(): Promise<NextIntl> {
  const actual = await vi.importActual<NextIntl>("next-intl")
  return {
    ...actual,
    useTranslations: ((namespace?: string) =>
      actual.createTranslator({
        locale: active.locale,
        messages: CATALOGUES[active.locale],
        namespace: namespace as never,
      })) as NextIntl["useTranslations"],
    useLocale: (() => active.locale) as NextIntl["useLocale"],
  }
}
