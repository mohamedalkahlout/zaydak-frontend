import { SettingsShell } from "@/shared/components/settings-shell"

/**
 * Platform settings. Same shell as the integrations screen — no app sidebar,
 * closed with the X or Escape — because these are the same kind of screen: a
 * form you open, change, and leave.
 *
 * No rail here yet. The integrations screen has one because it has three
 * routes to switch between; this branch is a single screen, and a nav column
 * listing one entry is a control with nothing to choose.
 */
export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SettingsShell>
      <main className="mx-auto w-full max-w-3xl">{children}</main>
    </SettingsShell>
  )
}
