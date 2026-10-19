import { redirect } from "next/navigation"

/**
 * `/settings` is a branch, not a screen. It redirects to the only leaf rather
 * than 404ing, so a hand-typed or bookmarked URL lands somewhere real.
 */
export default function SettingsIndexPage() {
  redirect("/settings/otp")
}
