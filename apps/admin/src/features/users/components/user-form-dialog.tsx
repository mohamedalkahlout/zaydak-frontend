"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
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
import { Checkbox } from "@repo/ui/components/checkbox"

import { UserRole } from "@/shared/api/generated/graphql"
import { ADMIN_UPDATE_USER, CREATE_USER } from "../api"
import {
  AVAILABLE_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLES,
  isPrivilegedRole,
  type UserRow,
} from "../types"
import {
  createUserSchema,
  editUserSchema,
  type CreateUserFormValues,
} from "../validations"

/**
 * Create an account, or edit an existing one.
 *
 * One dialog for both because the fields are the same minus the password:
 * `AdminUpdateUserInput` carries no password on purpose, so there is no admin
 * path that sets somebody's credential — a forgotten password goes through the
 * ordinary reset email.
 *
 * Empty strings are sent as `undefined`, not `""`. `email` and `phone` are
 * unique columns; posting an empty string would claim `""` as an address and
 * collide with the next account saved the same way. The one exception is a
 * phone blanked on an account that had one: `""` is how `adminUpdateUser` is
 * told to remove it, which is how a number somebody else typed onto an
 * account is given back to its owner.
 */
export function UserFormDialog({
  user,
  canAssignPrivilegedRoles,
  onClose,
  onSaved,
}: {
  /** `null` opens the create form. */
  user: UserRow | null
  /** `super_admin` only — mirrors `assertMayAssignRole` on the server. */
  canAssignPrivilegedRoles: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations("users")
  const editing = Boolean(user)
  const [error, setError] = useState<string | null>(null)
  const [create] = useMutation(CREATE_USER)
  const [update] = useMutation(ADMIN_UPDATE_USER)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    // The edit form drops `password`; the resolver swaps with it so the field
    // is not validated on a form that never renders it.
    resolver: zodResolver(
      (editing ? editUserSchema : createUserSchema) as typeof createUserSchema,
    ),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      // `User.role` is a String on the wire (it agrees with `me`), so the value
      // is widened back to the enum the inputs are written in terms of.
      role: (user?.role as UserRole) ?? UserRole.Customer,
      email_verified: user?.email_verified ?? false,
      password: "",
    },
  })

  const initialRole = (user?.role as UserRole) ?? UserRole.Customer
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(() => {
    if (user && Array.isArray(user.permissions)) {
      return [...user.permissions]
    }
    return [...ROLE_DEFAULT_PERMISSIONS[initialRole]]
  })

  const roles = ROLES.filter(
    (role) => canAssignPrivilegedRoles || !isPrivilegedRole(role),
  )

  async function onSubmit(values: CreateUserFormValues) {
    setError(null)
    const identity = {
      name: values.name,
      email: values.email || undefined,
      phone: values.phone || (user?.phone ? "" : undefined),
      role: values.role,
      email_verified: values.email_verified,
      permissions: selectedPermissions,
    }

    try {
      if (user) {
        await update({ variables: { input: { id: user.id, ...identity } } })
      } else {
        await create({
          variables: { input: { ...identity, password: values.password } },
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("form.editTitle", { name: user!.name }) : t("form.newTitle")}
          </DialogTitle>
          <DialogDescription>
            {editing ? t("form.editHint") : t("form.newHint")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Field label={t("form.name")} error={errors.name?.message}>
            <Input {...register("name")} autoComplete="off" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.email")} error={errors.email?.message}>
              <Input {...register("email")} type="email" autoComplete="off" dir="ltr" />
            </Field>
            <Field label={t("form.phone")} error={errors.phone?.message}>
              <Input {...register("phone")} autoComplete="off" dir="ltr" />
            </Field>
          </div>

          {editing ? null : (
            <Field label={t("form.password")} error={errors.password?.message}>
              <Input
                {...register("password")}
                type="password"
                autoComplete="new-password"
                dir="ltr"
              />
            </Field>
          )}

          <Field label={t("form.role")} error={errors.role?.message}>
            <Select
              value={watch("role")}
              onValueChange={(value) => {
                const nextRole = value as UserRole
                setValue("role", nextRole, { shouldDirty: true })
                setSelectedPermissions([...ROLE_DEFAULT_PERMISSIONS[nextRole]])
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`role.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-3 rounded-lg border border-border/60 p-3 bg-muted/20">
            <div>
              <Label className="text-sm font-medium">{t("permissions.title")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("permissions.hint")}
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const isSuperAdminOnly = perm === "manage_role_permissions"
                const disabled = isSuperAdminOnly && !canAssignPrivilegedRoles
                const isChecked = selectedPermissions.includes(perm)

                return (
                  <label
                    key={perm}
                    className={`flex items-start gap-2.5 rounded-md border p-2 text-sm transition-colors ${
                      disabled
                        ? "opacity-50 cursor-not-allowed border-border/40"
                        : "cursor-pointer hover:bg-accent/40 border-border/70"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={disabled}
                      onCheckedChange={() => {
                        if (disabled) return
                        setSelectedPermissions((prev) =>
                          prev.includes(perm)
                            ? prev.filter((p) => p !== perm)
                            : [...prev, perm],
                        )
                      }}
                    />
                    <span className="text-xs leading-relaxed select-none">
                      {t(`permissions.${perm}`)}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="email_verified" className="text-sm font-normal">
              {t("form.emailVerified")}
            </Label>
            <Switch
              id="email_verified"
              checked={watch("email_verified")}
              onCheckedChange={(value) =>
                setValue("email_verified", value, { shouldDirty: true })
              }
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : editing ? t("save") : t("form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-normal">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
