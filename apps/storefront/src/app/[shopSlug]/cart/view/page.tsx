import { SheinCartView } from "@/features/cart/components/shein-cart-view"

export default async function SheinCartViewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const token = typeof raw.t === "string" ? raw.t : ""
  return <SheinCartView token={token} />
}
