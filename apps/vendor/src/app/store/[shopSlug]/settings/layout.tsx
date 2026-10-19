import { Suspense } from "react"
import { SettingsShell } from "@/features/settings"

/**
 * The overlay frame for every settings URL.
 *
 * A layout rather than part of each page, so the rail — and its filter box —
 * survive navigation between sections and only the pane re-renders. Same shape
 * as the admin console's `/integrations` rail, for the same reason.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <SettingsShell>{children}</SettingsShell>
    </Suspense>
  )
}
