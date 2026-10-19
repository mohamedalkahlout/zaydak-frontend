import { readFileSync } from "fs"
import { resolve } from "path"
import { pathToFileURL } from "url"
import { glob } from "glob"
import {
  buildSchema,
  validate,
  NoUnusedFragmentsRule,
  specifiedRules,
  type DocumentNode,
} from "graphql"

/**
 * Every GraphQL document this app ships, checked against the real schema.
 *
 * **It exists because `graphql-codegen` cannot see most of them.** Codegen
 * extracts `gql()` arguments *statically*, so a template carrying a `${...}` is
 * invisible to it — and this app interpolates shared selection sets constantly.
 * `ShopWhatsAppThreads` appears zero times in `src/shared/api/generated/gql.ts`;
 * `MyUsageEvents`, which interpolates nothing, appears three. For the
 * interpolated majority a wrong field name is therefore not a build error but a
 * runtime failure with no type and no test behind it.
 *
 * Five had shipped that way, and none of them was noticed by a person:
 *
 * - `whatsAppInboxTicket` selected `expires_at`; the field is `ttl_seconds`. The
 *   ticket mutation failed validation, the hook's `silentErrors` `catch`
 *   swallowed it, and the inbox's live SSE stream could never open — it
 *   reconnected forever.
 * - `markWhatsAppThreadRead` passed `conversation_id:` where the argument is
 *   `id:`, and put a `{ success }` selection set on a `Boolean!`. Marking a
 *   thread read never worked.
 * - `DeleteShopPackage`, `UpdateShopPackage` and `SetDefaultShopPackage` each
 *   declared `$id: ID!` against a `String!` argument. GraphQL rejects an `ID!`
 *   variable in a `String!` position, so deleting, editing and defaulting a
 *   shipping package all failed server-side.
 *
 * **It validates the BUILT `DocumentNode`, not the source text**, and that is
 * the whole point: `gql` resolves the interpolation at import time, so this
 * sees exactly what the server would. A source-scanning check shares the
 * codegen's blind spot — one was written first, reported "1 failure", and
 * missed the two shipping siblings precisely because they interpolate.
 */

// __tests__ -> api -> shared -> src -> vendor -> apps -> repo root.
const SCHEMA_PATH = resolve(
  __dirname,
  "../../../../../../back-end/src/schema.gql",
)

/**
 * Dropped because each module is validated on its own. A file defining a
 * fragment used only by a sibling document is correct; the rule only has
 * meaning over a whole document set.
 */
const RULES = specifiedRules.filter((r) => r !== NoUnusedFragmentsRule)

function isDocument(value: unknown): value is DocumentNode {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "Document"
  )
}

describe("every GraphQL document validates against the back-end schema", () => {
  it("validates all of them", async () => {
    const schema = buildSchema(readFileSync(SCHEMA_PATH, "utf8"))

    const files = [
      ...new Set([
        ...(await glob("src/features/**/api*.ts", { ignore: "**/__tests__/**" })),
        ...(await glob("src/features/**/api/*.ts", {
          ignore: "**/__tests__/**",
        })),
      ]),
    ].filter((f) => !f.includes(".test."))

    const failures: string[] = []
    const unimportable: string[] = []
    let documents = 0

    for (const file of files) {
      let mod: Record<string, unknown>
      try {
        mod = (await import(pathToFileURL(resolve(file)).href)) as Record<
          string,
          unknown
        >
      } catch (err) {
        // Reported rather than skipped: a module this cannot import is a module
        // it is not checking, and a guard that quietly covers less than it
        // claims is the failure mode it was written to remove.
        unimportable.push(`${file}: ${(err as Error).message.split("\n")[0]}`)
        continue
      }

      for (const [name, value] of Object.entries(mod)) {
        if (!isDocument(value)) continue
        documents++
        const errors = validate(schema, value, RULES)
        if (errors.length) {
          failures.push(
            `${file} :: ${name}\n    ${errors.map((e) => e.message).join("\n    ")}`,
          )
        }
      }
    }

    expect(unimportable).toEqual([])
    expect(failures).toEqual([])

    // Floors rather than exact counts: a new feature must not have to edit this
    // test, but a glob that silently stops matching must not leave every
    // assertion above vacuously true either.
    expect(files.length).toBeGreaterThanOrEqual(60)
    expect(documents).toBeGreaterThanOrEqual(400)
  }, 120_000)
})
