import Link from "next/link"
import { ArrowLeftIcon, HomeIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@repo/ui/components/button"

/**
 * 404 for unmatched routes under `/store/*`. Renders inside
 * `DashboardLayout`, so the sidebar + topbar stay visible.
 */
export default async function DashboardNotFound() {
  const t = await getTranslations("errorPages")

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("notFound.title")}
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {t("storeNotFound.body")}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/store" />}>
          <ArrowLeftIcon className="size-4 rtl:-scale-x-100" />
          {t("notFound.goBack")}
        </Button>
        <Button nativeButton={false} render={<Link href="/store" />}>
          <HomeIcon className="size-4" />
          {t("storeNotFound.dashboardHome")}
        </Button>
      </div>
    </div>
  )
}
