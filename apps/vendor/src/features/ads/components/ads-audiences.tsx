"use client"

import { useTranslations } from "next-intl"
import { UsersIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"

/** Audience manager placeholder — no segments sync from ad platforms yet. */
export function AdsAudiences() {
  const t = useTranslations("ads.audiences")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UsersIcon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("emptyBody")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
