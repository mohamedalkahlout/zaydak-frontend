import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getClient } from "@/shared/lib/apollo"
import { ACTIVE_SHOP_KEY } from "@/shared/lib/auth/cookie-names"
import { GET_MY_SHOPS } from "@/features/shops/api"
import type { MyShopsResponse, Shop } from "@/features/shops/types"

export default async function DashboardIndexPage() {
  // Important: redirect() throws NEXT_REDIRECT to short-circuit rendering,
  // so it MUST live outside any try/catch — otherwise the catch swallows the
  // redirect and the user ends up on the fallback path every time.
  let shops: Shop[] = []
  try {
    const client = await getClient()
    const { data } = await client.query<MyShopsResponse>({ query: GET_MY_SHOPS })
    shops = data?.myShops?.data ?? []
  } catch {
    // Network / auth errors fall through; the dashboard layout's GET_ME
    // gate already redirects to /login on auth failure.
  }

  if (shops.length === 0) {
    redirect("/shops")
  }

  // Prefer the slug from the previous session if the user still owns that
  // shop; otherwise land them on the first available shop.
  const cookieStore = await cookies()
  const savedSlug = cookieStore.get(ACTIVE_SHOP_KEY)?.value
  const target = shops.find((s) => s.slug === savedSlug) ?? shops[0]
  redirect(`/store/${target.slug}`)
}
