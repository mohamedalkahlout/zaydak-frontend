import { Suspense } from "react"

import { LoginForm } from "@/features/auth/components/login-form"

/**
 * The phone sign-in, here as well as at `/login`: signing up is the same step
 * as signing in, and a customer has no password to reset — a link to this
 * page from before lands on the one way in there is.
 */
export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
