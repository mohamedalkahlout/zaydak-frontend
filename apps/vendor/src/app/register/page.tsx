import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SignupWizard } from "@/features/signup"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signup")
  return { title: t("rail.title") }
}

/**
 * Vendor signup. It wears the same `AuthShell` frame as `/login`, but stays
 * outside the `(auth)` group: the wizard passes its own shell slots (step row,
 * completion figure, wider card) instead of taking the layout's.
 */
export default function RegisterPage() {
  return <SignupWizard />
}
