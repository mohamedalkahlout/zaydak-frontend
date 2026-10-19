"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { AuthInput, AuthSubmit } from "@repo/ui/components/auth-form";
import { AuthHeading } from "@repo/ui/components/auth-heading";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@repo/ui/components/field";
import { LOGIN } from "@/features/auth/api"
import { SocialAuthButtons } from "@/features/auth/components/social-auth-buttons"
import { completeVendorSignIn } from "@/features/auth/lib/complete-vendor-sign-in"
import { clearSignupProgress } from "@/features/signup/lib/progress"
import { useDiscardSignupProgress } from "@/features/signup/lib/use-discard-signup-progress"
import type { LoginResponse } from "@/features/auth/types"
import { loginSchema, type LoginInput } from "@/features/auth/validations/auth";
import { useAuthStore } from "@/shared/stores/auth";
import { applyValidationErrors, getErrorCode } from "@/shared/lib/auth/graphql-errors";
import { sileo } from "sileo";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tv = useTranslations("auth.validation");
  const tStore = useTranslations("createStore");
  const router = useRouter();
  const searchParams = useSearchParams();
  const client = useApolloClient();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [failedAttempts, setFailedAttempts] = useState(0);
  // Login → Create must not resume a half-filled wizard from this tab.
  useDiscardSignupProgress();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema(tv)),
  });

  const [login, { loading }] = useMutation<LoginResponse>(LOGIN);

  const onSubmit = async (data: LoginInput) => {
    try {
      const { data: result } = await login({
        variables: { input: data },
      });
      if (result?.login?.success) {
        setFailedAttempts(0);
        await setTokens(result.login.data);
        sileo.success({
          title: t("login.welcomeBack"),
          description:
            result.login.data.email_verified === false
              ? t("login.checkInbox")
              : undefined,
        });
        // No shops yet (e.g. first Google account, or a customer who never
        // finished create-store) → mint one and open its dashboard.
        const dest = await completeVendorSignIn({
          client,
          temporaryName: tStore("temporaryName"),
          redirect: searchParams.get("redirect"),
        });
        router.push(dest);
      }
    } catch (err) {
      const code = getErrorCode(err);
      applyValidationErrors(err, setError, ["identifier", "password"]);

      if (code === "ACCOUNT_LOCKED") {
        sileo.error({
          title: t("login.accountLocked"),
          description: t("login.accountLockedDesc"),
        });
        return;
      }

      if (code && code !== "VALIDATION_ERROR") {
        const nextFailures = failedAttempts + 1;
        setFailedAttempts(nextFailures);
        if (nextFailures >= 3) {
          sileo.error({
            title: t("login.warning"),
            description: t("login.warningDesc"),
          });
        }
      }
    }
  };

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <FieldGroup>
        <AuthHeading
          eyebrow={t("login.eyebrow")}
          title={t("login.title")}
          description={t("login.subtitle")}
        />
        <Field>
          <FieldLabel htmlFor="identifier">{t("emailOrPhone")}</FieldLabel>
          <AuthInput
            id="identifier"
            dir="ltr"
            placeholder={t("emailOrPhonePlaceholder")}
            autoComplete="username"
            {...register("identifier")}
          />
          <FieldError errors={[errors.identifier]} />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
            <Link
              href="/forgot-password"
              className="ms-auto text-sm underline-offset-4 hover:underline"
            >
              {t("forgotPassword.title")}
            </Link>
          </div>
          <AuthInput
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <Field>
          <AuthSubmit disabled={loading}>
            {loading ? t("login.signingIn") : t("signIn")}
          </AuthSubmit>
        </Field>
        <FieldSeparator>{t("or")}</FieldSeparator>
        <SocialAuthButtons />
        <Field>
          {/* One focus stop, one role: a button-styled link — never a native
              <button> nested inside an <a>. */}
          <AuthSubmit
            variant="outline"
            nativeButton={false}
            render={<Link href="/verify-otp" />}
          >
            {t("login.signInWithOtp")}
          </AuthSubmit>
        </Field>
        <p className="text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link
            href="/register"
            onClick={clearSignupProgress}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("signUp")}
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
