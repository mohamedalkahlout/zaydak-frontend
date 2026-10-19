"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { CHANGE_PASSWORD } from "@/features/auth/api"
import type { ChangePasswordResponse } from "@/features/auth/types"
import { applyValidationErrors, getErrorCode } from "@/shared/lib/auth/graphql-errors"
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/features/auth/validations/auth"
import { useLogout } from "@/shared/lib/auth/use-logout"
import { sileo } from "sileo"

export default function ChangePasswordPage() {
  const t = useTranslations("changePassword")
  const tAuth = useTranslations("auth")
  const tv = useTranslations("auth.validation")
  const tCommon = useTranslations("common")
  const logout = useLogout()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema(tv)),
    defaultValues: {
      old_password: "",
      password: "",
      password_confirmation: "",
    },
  })

  const [changePassword, { loading }] =
    useMutation<ChangePasswordResponse>(CHANGE_PASSWORD)

  const onSubmit = async (data: ChangePasswordInput) => {
    try {
      const { data: result } = await changePassword({
        variables: {
          input: {
            old_password: data.old_password,
            password: data.password,
            password_confirmation: data.password_confirmation,
          },
        },
      })

      if (result?.changePassword?.success) {
        reset()
        sileo.success({
          title: t("changed"),
          description: t("changedDesc"),
        })
        // Backend already revoked all refresh tokens; logout finishes
        // the local-side cleanup (cookies, store, apollo cache) and
        // redirects to /login.
        await logout()
      }
    } catch (err) {
      const code = getErrorCode(err)

      if (code === "OLD_PASSWORD_INCORRECT" || code === "WRONG_CREDENTIALS") {
        setError("old_password", {
          type: "server",
          message: t("incorrectPassword"),
        })
        return
      }

      if (code === "PASSWORDS_DONT_MATCH") {
        setError("password_confirmation", {
          type: "server",
          message: t("passwordsMismatch"),
        })
        return
      }

      applyValidationErrors(err, setError, [
        "old_password",
        "password",
        "password_confirmation",
      ])
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form method="post" onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="old_password">{t("currentPassword")}</FieldLabel>
            <Input
              id="old_password"
              type="password"
              autoComplete="current-password"
              {...register("old_password")}
            />
            <FieldError errors={[errors.old_password]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{t("newPassword")}</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            <FieldError errors={[errors.password]} />
            <p className="text-xs text-muted-foreground">{tAuth("passwordHint")}</p>
          </Field>
          <Field>
            <FieldLabel htmlFor="password_confirmation">
              {t("confirmNewPassword")}
            </FieldLabel>
            <Input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              {...register("password_confirmation")}
            />
            <FieldError errors={[errors.password_confirmation]} />
          </Field>
          <Field>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? t("updating") : t("update")}
              </Button>
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<Link href="/store" />}
              >
                {tCommon("cancel")}
              </Button>
            </div>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
