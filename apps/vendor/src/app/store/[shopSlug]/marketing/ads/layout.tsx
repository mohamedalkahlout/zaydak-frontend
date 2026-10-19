import { AdsShell } from "@/features/ads"

export default function AdsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdsShell>{children}</AdsShell>
}
