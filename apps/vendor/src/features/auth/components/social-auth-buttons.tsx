"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { AuthSubmit } from "@repo/ui/components/auth-form"
import { Field } from "@repo/ui/components/field"

import { getErrorCode } from "@/shared/lib/auth/graphql-errors"
import { useAuthStore } from "@/shared/stores/auth"

import { SIGN_IN_WITH_SOCIAL } from "../api"
import { completeVendorSignIn } from "../lib/complete-vendor-sign-in"
import type { AuthTokenData } from "../types"
import {
  appleClientId,
  googleClientId,
  requestAppleIdToken,
  requestGoogleAccessToken,
  socialAuthConfigured,
} from "../lib/social-providers"

/**
 * Google / Apple under the login Or block. Hidden when neither public client
 * id is configured.
 *
 * A brand-new account has no shop yet — after tokens land we mint the same
 * temporary store `/create-store` would, then open its dashboard.
 */
export function SocialAuthButtons() {
  const t = useTranslations("auth")
  const tStore = useTranslations("createStore")
  const router = useRouter()
  const searchParams = useSearchParams()
  const client = useApolloClient()
  const setTokens = useAuthStore((s) => s.setTokens)
  const [signIn, { loading }] = useMutation<{
    signInWithSocial: { success: boolean; data?: AuthTokenData | null }
  }>(SIGN_IN_WITH_SOCIAL)
  const [localBusy, setLocalBusy] = useState(false)

  const googleId = googleClientId()
  const appleId = appleClientId()
  if (!socialAuthConfigured()) return null

  const busy = loading || localBusy

  async function finishSocial(input: {
    provider: "google" | "apple"
    id_token?: string
    access_token?: string
    name?: string
  }) {
    const { data: result } = await signIn({ variables: { input } })

    if (!result?.signInWithSocial?.success || !result.signInWithSocial.data) {
      sileo.error({ title: t("login.socialFailed") })
      return
    }

    await setTokens(result.signInWithSocial.data)
    sileo.success({
      title: t("login.welcomeBack"),
    })

    const dest = await completeVendorSignIn({
      client,
      temporaryName: tStore("temporaryName"),
      redirect: searchParams.get("redirect"),
    })
    router.push(dest)
  }

  async function run(job: () => Promise<void>) {
    setLocalBusy(true)
    try {
      await job()
    } catch (error) {
      const code = getErrorCode(error)
      if (code === "SOCIAL_TOKEN_INVALID") {
        sileo.error({ title: t("login.socialTokenInvalid") })
        return
      }
      if (code === "SOCIAL_AUTH_NOT_CONFIGURED") {
        sileo.error({ title: t("login.socialNotConfigured") })
        return
      }
      if (code === "SOCIAL_EMAIL_REQUIRED") {
        sileo.error({ title: t("login.socialEmailRequired") })
        return
      }
      if (code === "EMAIL_ALREADY_TAKEN") {
        sileo.error({ title: t("login.socialEmailTaken") })
        return
      }
      if (code === "ACCOUNT_LOCKED") {
        sileo.error({
          title: t("login.accountLocked"),
          description: t("login.accountLockedDesc"),
        })
        return
      }
      if (
        error instanceof Error &&
        /dismissed|cancelled|popup_closed|access_denied/i.test(error.message)
      ) {
        return
      }
      sileo.error({ title: t("login.socialFailed") })
    } finally {
      setLocalBusy(false)
    }
  }

  return (
    <>
      {googleId && (
        <Field>
          <AuthSubmit
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const accessToken = await requestGoogleAccessToken(googleId)
                await finishSocial({
                  provider: "google",
                  access_token: accessToken,
                })
              })
            }
          >
            {t("login.continueWithGoogle")}
          </AuthSubmit>
        </Field>
      )}
      {appleId && (
        <Field>
          <AuthSubmit
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const { idToken, name } = await requestAppleIdToken(appleId)
                await finishSocial({
                  provider: "apple",
                  id_token: idToken,
                  name,
                })
              })
            }
          >
            {t("login.continueWithApple")}
          </AuthSubmit>
        </Field>
      )}
    </>
  )
}
