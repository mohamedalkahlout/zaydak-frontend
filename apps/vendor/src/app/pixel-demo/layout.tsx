import type { ReactNode } from "react"
import { assertDevOnly } from "@/shared/lib/dev-only"

export default function PixelDemoLayout({
  children,
}: {
  children: ReactNode
}) {
  assertDevOnly()
  return children
}
