import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getClient, PreloadQuery } from "@/shared/lib/apollo"
import { GET_ME } from "@/features/auth/api"
import { GET_MY_SHOPS } from "@/features/shops/api"
import { DashboardShell } from "./_components/dashboard-shell"
import { ShopSwitchBoundary } from "@/shared/components/shop-switch-boundary"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Validate token server-side
  try {
    const client = await getClient()
    await client.query({ query: GET_ME })
  } catch {
    redirect("/login?expired=1")
  }

  return (
    <PreloadQuery query={GET_ME}>
      <PreloadQuery query={GET_MY_SHOPS}>
        {/* `DashboardShell` reads GET_ME and GET_MY_SHOPS with
            `useSuspenseQuery`, so a cache clear that cancels either one throws
            *here*, above `store/error.tsx` — and with no `app/error.tsx` in
            this app, that lands on the unstyled `global-error.tsx`. The
            boundary keeps the switch's own cancel out of it and paints the
            same skeleton the suspense fallback does. Everything else it
            rethrows. */}
        <ShopSwitchBoundary fallback={<DashboardSkeleton />}>
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardShell>{children}</DashboardShell>
          </Suspense>
        </ShopSwitchBoundary>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
    </div>
  )
}
