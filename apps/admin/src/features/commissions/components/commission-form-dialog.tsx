"use client"

import { bpsToPercent, centsToMajor } from "@/shared/lib/format"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"

import { commissionSchema, type CommissionInput } from "../validations"
import type { CommissionRow } from "../types"

interface CommissionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` opens the dialog in create mode. */
  commission: CommissionRow | null
  saving: boolean
  onSubmit: (values: CommissionInput) => Promise<void>
}

const EMPTY: CommissionInput = {
  level: "",
  sub_level: "",
  description: "",
  language: "en",
  min_balance: 0,
  max_balance: null,
  commission: 0,
}

/**
 * Create/edit form for a commission tier.
 *
 * The vendor dashboard's contextual save bar is mandatory for its editing
 * screens; that rule is scoped to `apps/vendor` (it depends on the `unsaved-bar`
 * store, which this app does not have). A modal with an explicit Save is the
 * right shape for a five-field tier row.
 */
export function CommissionFormDialog({
  open,
  onOpenChange,
  commission,
  saving,
  onSubmit,
}: CommissionFormDialogProps) {
  const t = useTranslations("commissions")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommissionInput>({
    resolver: zodResolver(commissionSchema),
    defaultValues: EMPTY,
  })

  // Re-seed whenever the dialog opens on a different row — react-hook-form keeps
  // its own state across renders, so a stale tier would otherwise leak into the
  // next edit.
  useEffect(() => {
    if (!open) return
    reset(
      commission
        ? {
            level: commission.level,
            sub_level: commission.sub_level ?? "",
            description: commission.description ?? "",
            language: commission.language,
            // The row is in cents / bps; the form edits major units and a
            // percent. The two converters are named so this boundary is
            // greppable and its inverse (`Math.round(x * 100)` on submit) has an
            // obvious partner.
            min_balance: centsToMajor(commission.min_balance_cents),
            max_balance:
              commission.max_balance_cents == null
                ? null
                : centsToMajor(commission.max_balance_cents),
            commission: bpsToPercent(commission.commission_bps),
          }
        : EMPTY,
    )
  }, [open, commission, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {commission ? t("form.editTitle") : t("form.createTitle")}
            </DialogTitle>
          </DialogHeader>

          <FieldGroup className="py-4">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="level">{t("column.level")}</FieldLabel>
                <Input id="level" {...register("level")} />
                <FieldError errors={[errors.level]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="sub_level">{t("column.subLevel")}</FieldLabel>
                <Input id="sub_level" {...register("sub_level")} />
                <FieldError errors={[errors.sub_level]} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="min_balance">{t("column.minBalance")}</FieldLabel>
                <Input
                  id="min_balance"
                  type="number"
                  step="0.01"
                  {...register("min_balance", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.min_balance]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="max_balance">{t("column.maxBalance")}</FieldLabel>
                <Input
                  id="max_balance"
                  type="number"
                  step="0.01"
                  placeholder={t("form.noCeiling")}
                  // An empty field means "open-ended top tier", not 0.
                  {...register("max_balance", {
                    setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                  })}
                />
                <FieldError errors={[errors.max_balance]} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="commission">{t("column.commission")}</FieldLabel>
                <Input
                  id="commission"
                  type="number"
                  step="0.01"
                  {...register("commission", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.commission]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="language">{t("column.language")}</FieldLabel>
                <Input id="language" {...register("language")} />
                <FieldError errors={[errors.language]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="description">{t("column.description")}</FieldLabel>
              <Input id="description" {...register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
