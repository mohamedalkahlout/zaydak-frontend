"use client"

import { useTranslations } from "next-intl"
import { ChevronDownIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"

/**
 * Internal-only knobs that rarely matter on a first-time create: a campaign
 * tag for attribution reports and a priority override that controls which
 * automatic discount the backend tries first when multiple match.
 */
export function AdvancedCard({ form }: { form: CouponFormApi }) {
  const t = useTranslations("coupons.advanced")
  const {
    register,
    formState: { errors },
  } = form

  return (
    <Card>
      <Collapsible>
        <CardHeader className="pb-0">
          <CollapsibleTrigger
            className="group flex w-full items-center justify-between text-left aria-expanded:[&_svg]:rotate-180"
            render={<button type="button" />}
          >
            <CardTitle>{t("title")}</CardTitle>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4 pt-4">
            <Field>
              <FieldLabel htmlFor="target">{t("campaignTag")}</FieldLabel>
              <Input
                id="target"
                placeholder={t("campaignTagPlaceholder")}
                {...register("target")}
              />
              <p className="text-xs text-muted-foreground">
                {t("campaignTagHint")}
              </p>
              <FieldError errors={[errors.target]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="priority">{t("priority")}</FieldLabel>
              <Input
                id="priority"
                type="number"
                min={0}
                step="1"
                placeholder="0"
                {...register("priority")}
              />
              <p className="text-xs text-muted-foreground">
                {t("priorityHint")}
              </p>
              <FieldError errors={[errors.priority]} />
            </Field>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
