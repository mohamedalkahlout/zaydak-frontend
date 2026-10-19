import type { ReactNode } from "react"
import { assertDevOnly } from "@/shared/lib/dev-only"

export default function SentryExampleLayout({
  children,
}: {
  children: ReactNode
}) {
  assertDevOnly()
  return children
}
