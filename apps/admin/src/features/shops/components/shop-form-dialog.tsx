"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { CheckIcon, SearchIcon, StoreIcon } from "lucide-react"

import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { Card } from "@repo/ui/components/card"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@repo/ui/components/drawer"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Switch } from "@repo/ui/components/switch"
import { Textarea } from "@repo/ui/components/textarea"
import { cn } from "@repo/ui/lib/utils"

import { USERS } from "@/features/users/api"
import type { UserRow } from "@/features/users/types"
import { UserRole } from "@/shared/api/generated/graphql"
import { CREATE_SHOP } from "../api"
import { shopStatus, statusBadgeVariant } from "../types"
import { createShopSchema, type CreateShopFormValues } from "../validations"

const EMPTY_FORM: CreateShopFormValues = {
  owner_id: "",
  name: "",
  slug: "",
  description: "",
  is_active: false,
  is_approved: false,
}

/**
 * Create a shop on an existing account.
 *
 * The surface is the vendor dashboard's create-target drawer: a bottom sheet
 * holding the form on the (logical) start side and a live preview of the shop
 * on the end side. A centred dialog could not hold this form — the owner picker
 * is a search box over a result list, so the fields below it fell past the
 * viewport with the header scrolled out of reach.
 *
 * Create only — there is no `adminUpdateShop`. A shop's name, description and
 * settings are the owner's to edit in the vendor dashboard; what the console
 * owns is bringing one into existence and the lifecycle switches around it.
 *
 * Both switches default off, matching the server's defaults: taking a
 * storefront live is a deliberate act, and a shop created already approved has
 * skipped the review the pending state exists for.
 */
export function ShopFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations("shops")
  const [error, setError] = useState<string | null>(null)
  const [owner, setOwner] = useState<OwnerCandidate | null>(null)
  const [create] = useMutation(CREATE_SHOP)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateShopFormValues>({
    resolver: zodResolver(createShopSchema),
    defaultValues: EMPTY_FORM,
  })

  // The drawer stays mounted so its open/close slide can play, which means one
  // admin's abandoned draft would still be in the fields the next time it is
  // opened. Clear everything on each rising edge of `open`.
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      reset(EMPTY_FORM)
      setOwner(null)
      setError(null)
    }
    prevOpen.current = open
  }, [open, reset])

  const values = watch()

  async function onSubmit(input: CreateShopFormValues) {
    setError(null)
    try {
      await create({
        variables: {
          input: {
            owner_id: input.owner_id,
            name: input.name,
            // Blank means "derive it from the name" — posting `""` would ask
            // the server to claim the empty slug.
            slug: input.slug || undefined,
            description: input.description || undefined,
            is_active: input.is_active,
            is_approved: input.is_approved,
          },
        },
      })
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="down"
      showSwipeHandle
    >
      <DrawerContent className="mx-auto max-h-[calc(100dvh-1.5rem)] max-w-4xl">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mx-auto flex min-h-0 w-full flex-1 flex-col"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3">
            <div className="min-w-0">
              <DrawerTitle>{t("form.newTitle")}</DrawerTitle>
              <DrawerDescription className="mt-0.5 text-xs">
                {t("form.newHint")}
              </DrawerDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("saving") : t("form.create")}
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4 lg:grid-cols-2">
            {error ? (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive lg:col-span-2"
              >
                {error}
              </p>
            ) : null}

            {/* Form card */}
            <div className="flex h-full flex-col gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <Field label={t("form.owner")} error={errors.owner_id?.message}>
                <OwnerPicker
                  selected={owner}
                  onSelect={(candidate) => {
                    setOwner(candidate)
                    setValue("owner_id", candidate.id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }}
                />
              </Field>

              <Field label={t("form.name")} error={errors.name?.message}>
                <Input {...register("name")} autoComplete="off" />
              </Field>

              <Field
                label={t("form.slug")}
                error={errors.slug?.message}
                hint={t("form.slugHint")}
              >
                <Input {...register("slug")} autoComplete="off" dir="ltr" />
              </Field>

              <Field
                label={t("form.description")}
                error={errors.description?.message}
              >
                <Textarea {...register("description")} rows={3} />
              </Field>
            </div>

            {/* Preview */}
            <div className="flex flex-col gap-3">
              <span className="font-medium">{t("form.preview")}</span>

              <ShopPreviewCard
                name={values.name}
                slug={values.slug}
                ownerName={owner?.name ?? null}
                isActive={values.is_active}
                isApproved={values.is_approved}
              />

              <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <SwitchRow
                  id="is_active"
                  label={t("form.active")}
                  hint={t("form.activeHint")}
                  checked={values.is_active}
                  onCheckedChange={(value) =>
                    setValue("is_active", value, { shouldDirty: true })
                  }
                />
                <SwitchRow
                  id="is_approved"
                  label={t("form.approved")}
                  hint={t("form.approvedHint")}
                  checked={values.is_approved}
                  onCheckedChange={(value) =>
                    setValue("is_approved", value, { shouldDirty: true })
                  }
                />
              </div>
            </div>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * The slug as it will most likely read, for the preview line only.
 *
 * Deliberately not the server's `slugify`: that one transliterates (Arabic to
 * Latin) through a dependency this app does not carry, and it resolves
 * collisions with a `-1` suffix it can only know about at write time. When the
 * name transliterates to nothing here, the preview falls back to the hint
 * rather than showing a slug the server would not produce.
 */
function previewSlug(name: string, slug: string): string {
  const source = slug.trim() || name.trim()
  return source
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * The shop as the list will show it once created — name, the status the two
 * switches add up to, and what each one actually gates.
 *
 * `is_approved` and `is_active` gate different things (the public directory and
 * the storefront itself), and the console's own status column collapses them,
 * so the preview spells both out beside the collapsed label.
 */
function ShopPreviewCard({
  name,
  slug,
  ownerName,
  isActive,
  isApproved,
}: {
  name: string
  slug: string
  ownerName: string | null
  isActive: boolean
  isApproved: boolean
}) {
  const t = useTranslations("shops")
  const status = shopStatus({ is_active: isActive, is_approved: isApproved })
  const derived = previewSlug(name, slug)

  return (
    <Card className="gap-4" glow={false}>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-semibold">
              {name.trim() || t("form.untitled")}
            </p>
            <p
              className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
              dir="ltr"
            >
              <StoreIcon className="size-3.5 shrink-0" />
              <span className="truncate">
                {derived ? `/${derived}` : t("form.slugPending")}
              </span>
            </p>
          </div>
          <Badge variant={statusBadgeVariant(status)} className="shrink-0">
            {t(`status.${status}`)}
          </Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
          <PreviewStat
            label={t("form.owner")}
            value={ownerName ?? t("form.ownerPending")}
          />
          <PreviewStat
            label={t("form.previewListing")}
            value={
              isApproved ? t("form.previewListed") : t("form.previewUnlisted")
            }
          />
          <PreviewStat
            label={t("form.previewStorefront")}
            value={isActive ? t("form.previewOnline") : t("form.previewOffline")}
          />
        </dl>
      </div>
    </Card>
  )
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  )
}

interface OwnerCandidate {
  id: string
  name: string
  email?: string | null
  role: string
}

/** The "search every role" sentinel — `Select` cannot hold `undefined`. */
const ANY_ROLE = "ANY"

const OWNER_RESULTS = 6

/**
 * Search the accounts and pick one to own the shop.
 *
 * There is no combobox primitive in `@repo/ui`, so this is an `Input` over a
 * scrollable list of buttons — deliberately not a `Select`, because the
 * candidate set is a server query, not an enumeration.
 *
 * It defaults to vendors but can search every role, because a `customer`
 * becomes a vendor the moment they own a shop: `adminCreateShop` promotes the
 * owner in the same transaction. Filtering to vendors only would hide exactly
 * the accounts this form exists to promote.
 */
function OwnerPicker({
  selected,
  onSelect,
}: {
  selected: OwnerCandidate | null
  onSelect: (candidate: OwnerCandidate) => void
}) {
  const t = useTranslations("shops")
  // The four role labels already exist for the users screen; a second copy of
  // them under `shops` would be one more thing to keep in step.
  const tRole = useTranslations("users.role")

  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [role, setRole] = useState<`${UserRole}` | typeof ANY_ROLE>(
    UserRole.Vendor,
  )

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, loading, error } = useQuery(USERS, {
    variables: {
      page: 1,
      limit: OWNER_RESULTS,
      search: query || undefined,
      role: role === ANY_ROLE ? undefined : (role as UserRole),
    },
  })

  const candidates: UserRow[] = data?.users.data ?? []

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("owner.searchPlaceholder")}
            aria-label={t("owner.searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <Select
          value={role}
          onValueChange={(value) => setRole(value as typeof role)}
        >
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UserRole.Vendor}>
              {t("owner.scopeVendors")}
            </SelectItem>
            <SelectItem value={ANY_ROLE}>{t("owner.scopeAll")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error.message}
        </p>
      ) : null}

      <ul className="max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {loading ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            {t("owner.loading")}
          </li>
        ) : null}

        {!loading && !error && candidates.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            {t("owner.empty")}
          </li>
        ) : null}

        {candidates.map((candidate) => {
          const chosen = candidate.id === selected?.id
          return (
            <li key={candidate.id}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() => onSelect(candidate)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-muted/60",
                  chosen && "bg-muted",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {candidate.name}
                  </span>
                  <span
                    className="block truncate text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {candidate.email ?? candidate.phone ?? "—"}
                  </span>
                </span>
                <Badge variant="outline">{tRole(candidate.role)}</Badge>
                <CheckIcon
                  className={cn(
                    "size-4 shrink-0 text-primary",
                    chosen ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-normal">{label}</Label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
