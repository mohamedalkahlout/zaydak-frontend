import { redirect } from "next/navigation"
import { getClient } from "@/shared/lib/apollo"
import { GET_ME } from "@/features/auth/api"

/**
 * The billing route's own shell — **no sidebar, no dashboard header**.
 *
 * A layout of its own rather than a page under `/store` because layouts in the
 * App Router nest unconditionally: anything below `store/layout.tsx` gets the
 * sidebar whether it wants it or not. Choosing a plan is a decision that
 * deserves the whole viewport, and a nav rail listing everything the vendor is
 * *not* doing right now is the one thing this screen does not need.
 *
 * It repeats the parent's token check rather than inheriting it — this route
 * no longer sits under that layout, so nothing else would stop a logged-out
 * visitor from rendering it.
 */
export default async function PlanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const client = await getClient()
    await client.query({ query: GET_ME })
  } catch {
    redirect("/login?expired=1")
  }

  return <div className="min-h-svh bg-background">{children}</div>
}
