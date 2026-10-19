import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { CodeSignIn } from "@/features/auth/components/code-sign-in"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth")
  return { title: t("verifyOtp.title") }
}

/**
 * Passwordless sign-in. It wears the same `AuthShell` frame as `/login` — it is
 * a sign-in, only the card's question differs. It stays outside the `(auth)`
 * group so the screen passes its own shell slots; the URL is unchanged, so
 * `proxy.ts` needed no edit.
 */
export default function VerifyOtpPage() {
  return <CodeSignIn />
}
