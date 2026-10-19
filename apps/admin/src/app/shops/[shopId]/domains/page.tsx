import { ShopDomains } from "@/features/shops/components/shop-domains"

export default async function ShopDomainsPage({
  params,
}: {
  params: Promise<{ shopId: string }>
}) {
  const { shopId } = await params
  return <ShopDomains shopId={shopId} />
}
