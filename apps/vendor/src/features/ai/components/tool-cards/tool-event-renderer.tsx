import { useTranslations } from "next-intl"
import { AlertTriangleIcon, WrenchIcon } from "lucide-react"
import type {
  CategorySalesResult,
  CollectionMembershipResult,
  CustomRangeStatsResult,
  DeleteCollectionResult,
  DeleteProductResult,
  FormPatchResult,
  GetCouponResult,
  GetProductResult,
  InventoryLocationsResult,
  ListCollectionsResult,
  ListCouponsResult,
  ListSystemCategoriesResult,
  LowStockProductsResult,
  NavigateToFormResult,
  SaveReceiptResult,
  SearchProductsResult,
  ShopStatsResult,
  TaskPlanResult,
  TopProductsResult,
  UpdateCollectionResult,
  VendorAgentToolEvent,
  YearlySalesResult,
} from "@/features/ai/lib/types"
import { CollectionsListCard } from "./collections-list-card"
import { ProductListCard } from "./product-list-card"
import { ProductDeletedCard } from "./product-deleted-card"
import { ShopStatsCard } from "./shop-stats-card"
import { LowStockCard } from "./low-stock-card"
import { InventoryLocationsCard } from "./inventory-locations-card"
import { ProductDetailsCard } from "./product-details-card"
import { NavigateToFormCard } from "./navigate-to-form-card"
import { FormPatchCard } from "./form-patch-card"
import { SaveReceiptCard } from "./save-receipt-card"
import { CollectionUpdatedCard } from "./collection-updated-card"
import { CollectionDeletedCard } from "./collection-deleted-card"
import { CollectionMembershipCard } from "./collection-membership-card"
import { TopProductsCard } from "./top-products-card"
import { YearlySalesCard } from "./yearly-sales-card"
import { CategorySalesCard } from "./category-sales-card"
import { CustomRangeStatsCard } from "./custom-range-stats-card"
import { CouponsListCard } from "./coupons-list-card"
import { CouponDetailsCard } from "./coupon-details-card"
import { CouponDeletedCard } from "./coupon-deleted-card"
import { TaskPlanCard } from "./task-plan-card"
import {
  AiImageGenerationCard,
  type AiImageGenerationToolResult,
} from "./ai-image-generation-card"
import { CategoryMatchCard } from "./category-match-card"

interface Props {
  event: VendorAgentToolEvent
  currency: string
  /** Picks the vendor's language out of the bilingual names a result carries
   * (`name.ar` / `name.en`). The cards' own copy comes from next-intl. */
  locale: "ar" | "en"
  /** Sends a message on the vendor's behalf, so a card can offer a choice
   * instead of making them retype it. Absent in the read-only shared view. */
  onSuggest?: (text: string) => void
}

function GenericToolCard({ event }: { event: VendorAgentToolEvent }) {
  const t = useTranslations("aiChat.toolCards.generic")
  return (
    <div className="border rounded-xl bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
      <WrenchIcon className="size-3.5" />
      <span>
        {t.rich("tool", {
          name: event.name,
          code: (chunks) => <code className="font-mono">{chunks}</code>,
        })}
      </span>
    </div>
  )
}

function ErrorCard({ message }: { message?: string | null }) {
  const t = useTranslations("aiChat.toolCards.error")
  return (
    <div className="border border-destructive/40 rounded-xl bg-destructive/5 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangleIcon className="size-4" />
        {t("title")}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {message ?? t("unknown")}
      </p>
    </div>
  )
}

export function ToolEventRenderer({
  event,
  currency,
  locale,
  onSuggest,
}: Props) {
  if (!event.ok) {
    return <ErrorCard message={event.error} />
  }

  const result = event.result
  if (typeof result !== "object" || result === null) {
    return <GenericToolCard event={event} />
  }

  // A change staged into the form already on screen (`patch_form`). Shape-
  // driven like the handoff below, and checked first: it is the answer to a
  // correction of that handoff, not a second one.
  if ("form_patch" in result) {
    return (
      <FormPatchCard result={result as FormPatchResult} locale={locale} />
    )
  }

  // navigate_to_form intents are shape-driven, not name-driven — any write
  // tool can surface a prefill handoff here.
  if ("navigate_to_form" in result) {
    return (
      <NavigateToFormCard
        result={result as NavigateToFormResult}
        locale={locale}
      />
    )
  }

  // And so is the save receipt: it is written by the server rather than by a
  // model turn, and it is filed under a tool name that has no tool behind it.
  if ("save_receipt" in result) {
    return <SaveReceiptCard result={result as SaveReceiptResult} />
  }

  // So is the warehouse question: a write tool that needs a location before
  // it can go on returns the same {count, locations} the lookup does, and the
  // vendor should see the list they are choosing from rather than a bare
  // "Tool: create_product" row.
  if ("needs_location" in result && "locations" in result) {
    return (
      <InventoryLocationsCard
        result={result as unknown as InventoryLocationsResult}
      />
    )
  }

  switch (event.name) {
    case "list_collections":
      if ("collections" in result) {
        return (
          <CollectionsListCard
            result={result as ListCollectionsResult}
            locale={locale}
          />
        )
      }
      break
    case "list_system_categories":
      if ("categories" in result) {
        return (
          <CategoryMatchCard
            result={result as ListSystemCategoriesResult}
            locale={locale}
            onSuggest={onSuggest}
          />
        )
      }
      break
    case "search_products":
      if ("products" in result) {
        return (
          <ProductListCard
            result={result as SearchProductsResult}
            currency={currency}
            locale={locale}
          />
        )
      }
      break
    case "get_product":
      if ("product" in result) {
        return (
          <ProductDetailsCard
            result={result as GetProductResult}
            currency={currency}
            locale={locale}
          />
        )
      }
      break
    case "delete_product":
      if ("id" in result) {
        return <ProductDeletedCard result={result as DeleteProductResult} />
      }
      break
    // Both stats tools have two payload shapes in persisted history (v1 and
    // `version: 2`, 2026-09-29). These keys are in both, so both route here
    // and the card picks the layout; renaming one drops the card silently.
    case "get_shop_stats":
      if ("revenue" in result) {
        return (
          <ShopStatsCard
            result={result as ShopStatsResult}
            currency={currency}
            locale={locale}
          />
        )
      }
      break
    case "get_low_stock_products":
      if ("threshold" in result) {
        return (
          <LowStockCard
            result={result as LowStockProductsResult}
            locale={locale}
          />
        )
      }
      break
    case "list_inventory_locations":
      if ("locations" in result) {
        return (
          <InventoryLocationsCard result={result as InventoryLocationsResult} />
        )
      }
      break
    case "update_collection":
      if ("collection" in result && "slug" in (result.collection as object)) {
        return (
          <CollectionUpdatedCard
            result={result as UpdateCollectionResult}
            locale={locale}
          />
        )
      }
      break
    case "delete_collection":
      if ("slug" in result && "message" in result) {
        return (
          <CollectionDeletedCard
            result={result as DeleteCollectionResult}
            locale={locale}
          />
        )
      }
      break
    case "add_product_to_collection":
    case "remove_product_from_collection":
      if ("action" in result && "collection" in result) {
        return (
          <CollectionMembershipCard
            result={result as CollectionMembershipResult}
            locale={locale}
          />
        )
      }
      break
    case "get_top_products":
      if ("products" in result && "count" in result) {
        return (
          <TopProductsCard
            result={result as TopProductsResult}
            currency={currency}
            locale={locale}
          />
        )
      }
      break
    case "get_yearly_sales":
      if ("year" in result && "months" in result) {
        return (
          <YearlySalesCard
            result={result as YearlySalesResult}
            currency={currency}
            locale={locale}
          />
        )
      }
      break
    case "get_category_sales":
      if ("categories" in result && "count" in result) {
        return <CategorySalesCard result={result as CategorySalesResult} />
      }
      break
    case "get_custom_range_stats":
      if ("range" in result && "total_revenue" in result) {
        return (
          <CustomRangeStatsCard
            result={result as CustomRangeStatsResult}
            currency={currency}
            locale={locale}
          />
        )
      }
      break
    case "list_coupons":
      if ("coupons" in result) {
        return <CouponsListCard result={result as ListCouponsResult} />
      }
      break
    case "get_coupon":
      if ("coupon" in result) {
        return <CouponDetailsCard result={result as GetCouponResult} />
      }
      break
    case "delete_coupon":
      if ("id" in result && "message" in result) {
        return <CouponDeletedCard />
      }
      break
    case "set_task_plan":
      if ("task_plan" in result) {
        return <TaskPlanCard result={result as TaskPlanResult} />
      }
      break
    case "generate_product_image":
      if ("generation_id" in result) {
        return (
          <AiImageGenerationCard
            result={result as AiImageGenerationToolResult}
          />
        )
      }
      break
  }

  return <GenericToolCard event={event} />
}
