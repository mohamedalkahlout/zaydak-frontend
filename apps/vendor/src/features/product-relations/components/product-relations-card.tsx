"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useLazyQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Link2, Plus, Trash2, Search } from "lucide-react"
import { sileo } from "sileo"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import { Skeleton } from "@repo/ui/components/skeleton"
import { Input } from "@repo/ui/components/input"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@repo/ui/components/tabs"
import { cn } from "@/shared/lib/utils"
import {
  ADD_PRODUCT_RELATION,
  GET_PRODUCT_RELATIONS,
  REMOVE_PRODUCT_RELATION,
} from "../api"
import type {
  AddProductRelationResponse,
  ProductRelation,
  ProductRelationType,
  ProductRelationsQueryResponse,
  RemoveProductRelationResponse,
} from "../types"
import { GET_PRODUCTS } from "@/features/products/api"
import type { ProductsResponse } from "@/features/products/types"
import type { TranslatedText } from "@/shared/types/api"

/**
 * The four storefront slots, in tab order. Each tab's name and the line under
 * it are `productRelations.types.<TYPE>.{label,hint}`.
 */
const TYPE_TABS: readonly ProductRelationType[] = [
  "RELATED",
  "UPSELL",
  "CROSS_SELL",
  "COMPLEMENTARY",
]

/**
 * Vendor surface for cross-sells / upsells / bundles. Hidden in create mode
 * — there's no productId until the listing is saved, so the picker has
 * nothing to anchor against. The four `ProductRelationType` buckets surface
 * as tabs so the vendor can curate each storefront slot independently.
 *
 * Each tab shows:
 *   1. Current relations for that type (chips with × to remove)
 *   2. A live-search picker over the shop's products to add new ones
 *
 * Position management is intentionally minimal — relations sort by
 * created_at within each type, which mirrors the order the vendor adds
 * them. Drag-reorder UI can be added later if vendor analytics show it's
 * needed.
 */
export function ProductRelationsCard({ productId }: { productId?: string }) {
  const t = useTranslations("productRelations")
  const [activeType, setActiveType] = useState<ProductRelationType>("RELATED")

  if (!productId) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeType}
          onValueChange={(v) => setActiveType(v as ProductRelationType)}
        >
          <TabsList>
            {TYPE_TABS.map((type) => (
              <TabsTrigger key={type} value={type}>
                {t(`types.${type}.label`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {TYPE_TABS.map((type) => (
            <TabsContent key={type} value={type} className="mt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                {t(`types.${type}.hint`)}
              </p>
              <RelationsPanel productId={productId} type={type} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function RelationsPanel({
  productId,
  type,
}: {
  productId: string
  type: ProductRelationType
}) {
  const t = useTranslations("productRelations")
  const { data, loading, refetch } = useQuery<ProductRelationsQueryResponse>(
    GET_PRODUCT_RELATIONS,
    {
      variables: { product_id: productId, type },
      fetchPolicy: "cache-and-network",
    },
  )
  const relations = data?.productRelations?.data ?? []

  const [remove, removeState] = useMutation<RemoveProductRelationResponse>(
    REMOVE_PRODUCT_RELATION,
  )
  const [add, addState] = useMutation<AddProductRelationResponse>(
    ADD_PRODUCT_RELATION,
  )

  const onRemove = async (id: string) => {
    try {
      await remove({ variables: { id } })
      void refetch()
    } catch (err) {
      sileo.error({
        title: t("removeFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  const onAdd = async (targetId: string) => {
    try {
      await add({
        variables: {
          input: {
            source_product_id: productId,
            target_product_id: targetId,
            type,
          },
        },
      })
      void refetch()
    } catch (err) {
      sileo.error({
        title: t("addFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {loading && relations.length === 0 ? (
        <Skeleton className="h-20 w-full" />
      ) : relations.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {relations.map((r) => (
            <RelationRow
              key={r.id}
              relation={r}
              onRemove={() => onRemove(r.id)}
              removing={removeState.loading}
            />
          ))}
        </ul>
      )}

      <ProductPicker
        excludeIds={[productId, ...relations.map((r) => r.target_product_id)]}
        onPick={onAdd}
        disabled={addState.loading}
      />
    </div>
  )
}

function RelationRow({
  relation,
  onRemove,
  removing,
}: {
  relation: ProductRelation
  onRemove: () => void
  removing: boolean
}) {
  // The relation row holds the target's id but not its name — the vendor
  // typically remembers what they linked. Showing a label fetch here would
  // burn one query per row; we'd batch via Apollo cache hits only when
  // the target was already listed elsewhere. For the MVP we surface the id
  // as a truncated chip + the position number so the vendor can match it
  // against the storefront preview. A follow-up can wire a single bulk
  // query over `relations.map(r => r.target_product_id)`.
  return (
    <li className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant="secondary" className="font-mono text-[10px]">
          #{relation.position}
        </Badge>
        <span className="truncate font-mono text-xs">
          {relation.target_product_id}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        disabled={removing}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  )
}

function ProductPicker({
  excludeIds,
  onPick,
  disabled,
}: {
  excludeIds: string[]
  onPick: (id: string) => void
  disabled: boolean
}) {
  const t = useTranslations("productRelations")
  const [query, setQuery] = useState("")
  const [run, { data, loading }] = useLazyQuery<ProductsResponse>(GET_PRODUCTS, {
    fetchPolicy: "network-only",
  })

  const onSearch = (next: string) => {
    setQuery(next)
    if (next.trim().length < 2) return
    void run({
      variables: { filters: { search: next.trim(), limit: 8 } },
    })
  }

  // Filter out the current product + already-linked ones so the picker
  // can't add duplicates (the backend would also reject with
  // `RELATION_ALREADY_EXISTS`, but doing it client-side is faster UX).
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds])
  const results = (data?.products?.data ?? []).filter(
    (p) => !excludeSet.has(p.id),
  )

  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-9 pl-8"
        />
      </div>
      {query.trim().length >= 2 && (
        <div
          className={cn(
            "mt-2 max-h-56 overflow-y-auto rounded-md border bg-background",
            results.length === 0 && !loading && "text-center",
          )}
        >
          {loading ? (
            <div className="p-2">
              <Skeleton className="h-6 w-full" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              {t("noMatches")}
            </p>
          ) : (
            <ul className="divide-y">
              {results.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="truncate">{labelOf(p.name) || p.slug}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onPick(p.id)}
                    disabled={disabled}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function labelOf(name: string | TranslatedText | null | undefined): string {
  if (!name) return ""
  if (typeof name === "string") return name
  return name.en ?? name.ar ?? Object.values(name)[0] ?? ""
}
