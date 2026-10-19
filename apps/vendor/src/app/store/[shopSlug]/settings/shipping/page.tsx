import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  GET_SHIPPING_RULES,
  GET_SHIPPING_ZONES,
  SHIPPING_RULES_VARIABLES,
} from "@/features/shipping/api"
import {
  GET_SHIPPING_PROVIDER_ACCOUNTS,
  GET_SHIPPING_PROVIDER_CATALOG,
  GET_SHOP_SHIPPING_SETTINGS,
} from "@/features/shipping/providers-api"
import { ShippingPane } from "@/features/settings"
import { SHOP_COUNTRY_CAPABILITIES } from "@/features/shops/api"

/**
 * The pane's queries start on the server, so the first paint carries the
 * zones, rates, carrier accounts and the shop's country profile rather than
 * a skeleton the client fills in after hydration — same preload +
 * `useSuspenseQuery` shape as the storefront and the reviews page.
 *
 * The wrappers never await each other: each `PreloadQuery` starts its query
 * and returns immediately, so nesting costs nothing and they are in flight
 * together. `SHIPPING_RULES_VARIABLES` is shared with the pane's reader so
 * the two can never drift apart. The country profile is what keeps the
 * catch-all error off a Palestine shop.
 */
export default function SettingsShippingPage() {
  return (
    <PreloadQuery query={SHOP_COUNTRY_CAPABILITIES}>
      <PreloadQuery query={GET_SHOP_SHIPPING_SETTINGS}>
        <PreloadQuery query={GET_SHIPPING_PROVIDER_CATALOG}>
          <PreloadQuery query={GET_SHIPPING_PROVIDER_ACCOUNTS}>
            <PreloadQuery query={GET_SHIPPING_ZONES}>
              <PreloadQuery
                query={GET_SHIPPING_RULES}
                variables={SHIPPING_RULES_VARIABLES}
              >
                <Suspense fallback={<ShippingSkeleton />}>
                  <ShippingPane />
                </Suspense>
              </PreloadQuery>
            </PreloadQuery>
          </PreloadQuery>
        </PreloadQuery>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function ShippingSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-24 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}
