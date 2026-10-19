import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { AuthShell } from "@repo/ui/components/auth-shell"
import { Button } from "@repo/ui/components/button"

import { LocaleSwitcher } from "@/shared/components/locale-switcher"
import { AppLogo } from "@/shared/components/app-logo"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations("auth")

  return (
    <AuthShell
      brand={<AppLogo variant="desktop" size="lg" href={null} />}
      eyebrow={t("layout.eyebrow")}
      headline={t("layout.headline")}
      quote={t("layout.quote")}
      quoteAuthor={t("layout.quoteAuthor")}
      chips={[
        t("layout.chipCatalog"),
        t("layout.chipPayments"),
        t("layout.chipReports"),
      ]}
      backLink={
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
          {/* The chevron points back the way the reader came, either direction. */}
          <ChevronLeftIcon className="size-4 rtl:rotate-180" />
          {t("layout.home")}
        </Button>
      }
      toolbar={<LocaleSwitcher variant="labeled" />}
    >
      <Suspense>{children}</Suspense>
    </AuthShell>
  )
}
