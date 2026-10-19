"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  DEFAULT_RECOVERY_STEPS_MINUTES,
  MAX_RECOVERY_STEPS,
  MIN_STEP_SPACING_MINUTES,
  clampRecoverySteps,
  draftsFromSteps,
  minutesFromDraft,
  type CadenceStepDraft,
  type CadenceUnit,
} from "@/features/abandoned-carts/lib/cadence"

export function AbandonedCartsCadenceEditor({
  drafts,
  onChange,
}: {
  drafts: CadenceStepDraft[]
  onChange: (next: CadenceStepDraft[]) => void
}) {
  const t = useTranslations("settings.abandonedCarts")
  // Handed to each unit select's root as `items`: without them Base UI's
  // SelectValue prints the raw unit ("hours") in the trigger, not its label.
  const unitOptions: { value: CadenceUnit; label: string }[] = [
    { value: "minutes", label: t("unitMinutes") },
    { value: "hours", label: t("unitHours") },
    { value: "days", label: t("unitDays") },
  ]
  const canAdd = drafts.length < MAX_RECOVERY_STEPS
  const minutes = drafts.map(minutesFromDraft)
  const clamped = clampRecoverySteps(minutes)
  const clampDiffers = minutes.join(",") !== clamped.join(",")

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {drafts.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              aria-label={t("amountLabel", { n: index + 1 })}
              className="w-20"
              value={Number.isFinite(row.amount) ? row.amount : ""}
              onChange={(event) => {
                const amount = Number(event.target.value)
                onChange(
                  drafts.map((item, i) =>
                    i === index ? { ...item, amount } : item,
                  ),
                )
              }}
            />
            <Select
              items={unitOptions}
              value={row.unit}
              onValueChange={(unit) =>
                onChange(
                  drafts.map((item, i) =>
                    i === index ? { ...item, unit: unit as CadenceUnit } : item,
                  ),
                )
              }
            >
              <SelectTrigger
                size="sm"
                className="h-8 w-[7.5rem]"
                aria-label={t("unitLabel", { n: index + 1 })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {drafts.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("removeStep", { n: index + 1 })}
                onClick={() => onChange(drafts.filter((_, i) => i !== index))}
              >
                <Trash2Icon className="size-4" />
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAdd}
          onClick={() =>
            onChange([...drafts, { amount: 1, unit: "days" }])
          }
        >
          <PlusIcon className="size-3.5" />
          {t("addStep")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(draftsFromSteps([...DEFAULT_RECOVERY_STEPS_MINUTES]))}
        >
          {t("resetDefault")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("stepsRules")}</p>
      {clampDiffers ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("stepsClampHint", { spacing: MIN_STEP_SPACING_MINUTES })}
        </p>
      ) : null}
    </div>
  )
}
