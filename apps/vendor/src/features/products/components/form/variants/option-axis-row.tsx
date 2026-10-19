"use client"

import {
  AlertCircleIcon,
  DatabaseIcon,
  GripVerticalIcon,
  Trash2Icon,
  ViewIcon,
} from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { cn } from "@/shared/lib/utils"
import { scrollToMetafields } from "@/features/products/lib/form/attribute-values"
import type { OptionAxis } from "./use-variant-options"
import { ConstrainedValuesInput } from "./constrained-values-input"
import { VariantValuesInput } from "./variant-values-input"
import { useTranslations } from "next-intl"

interface OptionAxisRowProps {
  axis: OptionAxis
  onStartEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onDone: () => void
  onDraftNameChange: (name: string) => void
  onDraftValuesChange: (values: string[]) => void
  /** Called from the "Disconnect" menu item on the connected-metafield badge. */
  onDisconnect?: () => void
}

/**
 * One row in the options list. Two visual states:
 *  - committed/collapsed → shows the axis name + its value chips (clickable
 *    to open the editor again)
 *  - editing → shows the name input, values input, and Delete/Done actions
 */
export function OptionAxisRow({
  axis,
  onStartEdit,
  onCancelEdit,
  onDelete,
  onDone,
  onDraftNameChange,
  onDraftValuesChange,
  onDisconnect,
}: OptionAxisRowProps) {
  const t = useTranslations("products")
  const tc = useTranslations("common")
  const connected = axis.connectedAttribute ?? null
  if (!axis.isEditing) {
    // The whole row opens the editor, but the connected-metafield badge is a
    // menu trigger — i.e. a second button. Nesting one button in another is
    // invalid HTML and React refuses to hydrate it, so the row is a plain
    // container and the name button stretches over it with an `::after`
    // overlay. The badge sits above that overlay on its own stacking context,
    // which is what keeps its click opening the menu instead of the editor.
    return (
      <div className="relative flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/40">
        <GripVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onStartEdit}
              className="min-w-0 truncate rounded-sm text-left text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {axis.name}
            </button>
            {connected && (
              <ConnectedBadgeMenu
                connected={connected}
                onDisconnect={onDisconnect}
                className="relative z-10"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {axis.values.map((v) => (
              <span
                key={v}
                className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const nameError =
    axis.draftName.trim() === ""
      ? t("optionAxisRow.nameRequired")
      : undefined

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <GripVerticalIcon className="mt-7 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Field>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor={`opt-name-${axis.id}`}>
              {t("optionAxisRow.optionName")}
            </FieldLabel>
            {connected && (
              <ConnectedBadgeMenu
                connected={connected}
                onDisconnect={onDisconnect}
              />
            )}
          </div>
          <Input
            id={`opt-name-${axis.id}`}
            autoFocus
            placeholder={t("optionAxisRow.namePlaceholder")}
            value={axis.draftName}
            onChange={(e) => onDraftNameChange(e.target.value)}
            className={cn(
              nameError && "border-destructive/60 bg-destructive/5",
            )}
          />
          {nameError && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircleIcon className="size-3.5" />
              {nameError}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel>{t("optionAxisRow.optionValues")}</FieldLabel>
          {connected && connected.options.length > 0 ? (
            // Connected axis — same chip-box UI as the free-text input,
            // but clicking opens a dropdown constrained to the metafield's
            // option set (no free typing, per user request).
            <ConstrainedValuesInput
              values={axis.draftValues}
              onChange={onDraftValuesChange}
              options={connected.options}
              placeholder={t("metafields.addValue", {
                name: connected.label.toLowerCase(),
              })}
            />
          ) : (
            <VariantValuesInput
              values={axis.draftValues}
              onChange={onDraftValuesChange}
              placeholder={t("optionAxisRow.valuesPlaceholder")}
            />
          )}
        </Field>

        <div className="flex items-center justify-between pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onDelete}>
            {tc("delete")}
          </Button>
          <div className="flex items-center gap-2">
            {axis.name !== "" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
              >
                {tc("cancel")}
              </Button>
            )}
            <Button type="button" size="sm" onClick={onDone}>
              {tc("done")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Small pill showing that this axis is linked to a category metafield.
 * Clicking it opens a menu with:
 *   - View metafield — scrolls the matching metafield row into view.
 *   - Disconnect — drops the axis so the metafield owns the value again.
 *
 * Styled after the Shopify "metaobject" chip the user referenced — DB
 * icon + label on a tinted background.
 */
function ConnectedBadgeMenu({
  connected,
  onDisconnect,
  className,
}: {
  connected: { key: string; label: string }
  onDisconnect?: () => void
  className?: string
}) {
  const t = useTranslations("products")
  const handleView = () => scrollToMetafields(connected.key)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Badge
            {...props}
            // `Badge` is a `<span>` by default, and Base UI's trigger warns
            // (correctly) that dropping native button semantics costs keyboard
            // and forms behaviour. This one genuinely is a button, so it gets a
            // real one rather than `nativeButton={false}` — and `type="button"`
            // is load-bearing: the badge sits inside the product form, where a
            // bare `<button>` defaults to `type="submit"`.
            render={<button type="button" />}
            variant="outline"
            className={cn(
              "h-6 cursor-pointer gap-1 border-sky-200 bg-sky-50 px-1.5 font-medium text-sky-900 transition hover:bg-sky-100",
              className,
            )}
          >
            <DatabaseIcon className="size-3" />
            {connected.label}
          </Badge>
        )}
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleView}>
          <ViewIcon className="size-4" />
          {t("viewMetafield")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDisconnect}
          className="text-destructive focus:text-destructive"
        >
          <Trash2Icon className="size-4" />
          {t("disconnect")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
