import Link from "next/link"
import { ArrowLeftIcon, HomeIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@repo/ui/components/button"

export default async function NotFound() {
  const t = await getTranslations("errorPages.notFound")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {t("body")}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeftIcon className="size-4 rtl:-scale-x-100" />
          {t("goBack")}
        </Button>
        <Button nativeButton={false} render={<Link href="/store" />}>
          <HomeIcon className="size-4" />
          {t("dashboard")}
        </Button>
      </div>
    </div>
  )
}
