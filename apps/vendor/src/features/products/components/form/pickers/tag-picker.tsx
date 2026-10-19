"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"
import { useMutation, useQuery } from "@apollo/client/react"
import { sileo } from "sileo"
import { CREATE_TAG, GET_TAGS } from "@/features/tags/api"
import type { CreateTagResponse, TagsResponse } from "@/features/tags/types"
import { translatable } from "@/shared/lib/format"
import type { ProductFormApi } from "@/features/products/validations/product"
import { ChipPicker, type PickerGroup } from "./chip-picker"

const TAGS_VARIABLES = { page: 1, limit: 100 }

/** How many of the shop's most-applied tags head the list. */
const FREQUENT_COUNT = 5

/**
 * A tag typed straight into the picker is one word in one language, and which
 * language it is decides the column it belongs in. Guessing wrong writes Latin
 * text into `name.ar`, which the storefront then shows to Arabic customers.
 */
function nameJsonFor(value: string): Record<string, string> {
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x0600 && cp <= 0x06ff) return { ar: value }
  }
  return { en: value }
}

export function TagPicker({
  form,
  snapshots,
}: {
  form: ProductFormApi
  snapshots?: Record<string, string>
}) {
  const t = useTranslations("products.tags")

  const { data } = useQuery<TagsResponse>(GET_TAGS, {
    variables: TAGS_VARIABLES,
    fetchPolicy: "cache-first",
  })

  const [createTag] = useMutation<CreateTagResponse>(CREATE_TAG, {
    refetchQueries: [{ query: GET_TAGS, variables: TAGS_VARIABLES }],
    awaitRefetchQueries: true,
  })

  const groups = useMemo<PickerGroup[]>(() => {
    // `tag` rather than `t`: the translator is `t` in this scope now, and a
    // shadow that silently wins inside one arrow is not worth the two saved
    // characters.
    const all = (data?.tags?.data ?? []).map((tag) => ({
      id: tag.id,
      label: translatable(tag.name),
      uses: tag.products_count ?? 0,
    }))

    const byName = (a: { label: string }, b: { label: string }) =>
      a.label.localeCompare(b.label)

    const frequent = [...all]
      .filter((tag) => tag.uses > 0)
      .sort((a, b) => b.uses - a.uses)
      .slice(0, FREQUENT_COUNT)

    // Two headings over a short list is chrome, not orientation — below the
    // split point every tag is "frequently used" as far as the shop is
    // concerned, so the list stays flat.
    if (frequent.length === 0 || all.length <= FREQUENT_COUNT) {
      return [{ options: [...all].sort(byName) }]
    }

    const frequentIds = new Set(frequent.map((tag) => tag.id))
    return [
      { label: t("frequentlyUsed"), options: frequent },
      {
        label: t("other"),
        options: all.filter((tag) => !frequentIds.has(tag.id)).sort(byName),
      },
    ]
  }, [data, t])

  const create = async (name: string): Promise<string | null> => {
    try {
      const res = await createTag({
        variables: { input: { name: nameJsonFor(name) } },
      })
      const tag = res.data?.createTag?.data
      if (!res.data?.createTag?.success || !tag) {
        sileo.error({ title: t("createFailed") })
        return null
      }
      return tag.id
    } catch (err) {
      sileo.error({
        title: t("createFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
      return null
    }
  }

  return (
    <Controller
      control={form.control}
      name="tag_ids"
      render={({ field }) => (
        <ChipPicker
          label={t("label")}
          addLabel={t("add")}
          value={(field.value as string[]) ?? []}
          onChange={(ids) => field.onChange(ids)}
          groups={groups}
          snapshots={snapshots}
          searchPlaceholder={t("search")}
          onCreateOption={create}
        />
      )}
    />
  )
}
