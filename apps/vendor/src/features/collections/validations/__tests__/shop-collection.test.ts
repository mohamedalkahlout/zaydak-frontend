import { describe, expect, it } from "vitest"
import {
  collectionFormDefaults,
  newCondition,
  newSource,
} from "@/features/collections/lib/rules"
import {
  MAX_TOTAL_CONDITIONS,
  collectionFormSchema as collectionFormSchemaFor,
  countConditions,
  type CollectionFormInput,
  type ConditionInput,
  type SourceInput,
} from "@/features/collections/validations/shop-collection"
import { enTranslator } from "@/shared/test/next-intl"

// Built over the real English catalogue, the way the editor builds it over
// the active locale's.
const collectionFormSchema = collectionFormSchemaFor(
  enTranslator("collections.validation"),
)

// The API refuses a collection over MAX_TOTAL_CONDITIONS, and because the same
// check runs on `previewCollection` the items panel silently freezes one row
// over. These pin the client-side mirror: the count is the evaluator's (source
// conditions plus exclusion conditions, per collection), and the schema
// refuses at exactly the same line, pointing at `sources` so the save bar
// carries the message before any round trip.

const filled = (): ConditionInput => ({
  ...newCondition("brand"),
  values: ["Acme"],
})

const fill = (count: number): ConditionInput[] =>
  Array.from({ length: count }, filled)

const withSources = (sources: SourceInput[]): CollectionFormInput => ({
  ...collectionFormDefaults(),
  name: { en: "Summer", ar: "" },
  sources,
})

describe("countConditions", () => {
  it("adds source conditions and exclusion conditions across every source", () => {
    const first = newSource("a")
    const sources: SourceInput[] = [
      {
        ...first,
        conditions: fill(2),
        exclude: { ...first.exclude, conditions: fill(3) },
      },
      { ...newSource("b"), conditions: fill(4) },
    ]
    expect(countConditions(sources)).toBe(9)
  })

  it("counts nothing for a collections source's picks", () => {
    const sources: SourceInput[] = [
      { ...newSource("a"), kind: "COLLECTIONS", collection_ids: ["x", "y"] },
    ]
    expect(countConditions(sources)).toBe(0)
  })
})

describe("collectionFormSchema", () => {
  it("accepts exactly the budget", () => {
    const result = collectionFormSchema.safeParse(
      withSources([
        { ...newSource("a"), conditions: fill(MAX_TOTAL_CONDITIONS) },
      ]),
    )
    expect(result.success).toBe(true)
  })

  it("refuses one over, at the sources path, naming the cap", () => {
    // Split between a source and its exclusions: the budget is per
    // collection, not per list, so the two halves have to be added together.
    const first = newSource("a")
    const result = collectionFormSchema.safeParse(
      withSources([
        {
          ...first,
          conditions: fill(MAX_TOTAL_CONDITIONS - 5),
          exclude: { ...first.exclude, conditions: fill(6) },
        },
      ]),
    )
    expect(result.success).toBe(false)
    const issue = result.error?.issues.find(
      (candidate) => candidate.path.join(".") === "sources",
    )
    expect(issue?.message).toContain(String(MAX_TOTAL_CONDITIONS))
  })

  it("takes an Arabic-only title as a title", () => {
    const result = collectionFormSchema.safeParse({
      ...withSources([newSource("a")]),
      name: { en: "", ar: "صيف" },
    })
    expect(result.success).toBe(true)
  })

  it("still needs one locale filled in", () => {
    const result = collectionFormSchema.safeParse({
      ...withSources([newSource("a")]),
      name: { en: " ", ar: "" },
    })
    expect(result.success).toBe(false)
    expect(
      result.error?.issues.some(
        (candidate) => candidate.path.join(".") === "name",
      ),
    ).toBe(true)
  })
})
