/**
 * The shape of a next-intl `t`, for code that is handed one rather than
 * calling `useTranslations` itself: zod schema factories, column builders,
 * option lists built outside a component.
 *
 * A zod message is fixed when the schema is built, so a schema with English
 * literals in it stays English under an Arabic dashboard no matter how the
 * error is rendered. Building the schema from `t` (`loginSchema(t)`) is what
 * puts the active locale into it. Tests pass `enTranslator(namespace)` from
 * `@/shared/test/next-intl`.
 */
export type Translate = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string
