import type { ReactNode } from "react"
import { assertDevOnly } from "@/shared/lib/dev-only"

export default function BoardingPassLayout({
  children,
}: {
  children: ReactNode
}) {
  assertDevOnly()
  return children
}
