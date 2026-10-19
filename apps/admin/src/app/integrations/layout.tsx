import { SettingsShell } from "@/shared/components/settings-shell"
import { IntegrationRail } from "@/features/integrations/components/integration-rail"

/**
 * Two columns: the type rail, then whichever type's settings the URL names.
 *
 * `SettingsShell` rather than `DashboardShell` — the app sidebar is dropped
 * here because the rail below already is one, and two nav columns side by side
 * are two answers to the same question. Closing (X, or Escape) returns to the
 * console.
 *
 * The rail lives in the layout rather than in the page so it is not remounted
 * on every navigation — switching from Email to SMS keeps its filter box, and
 * only the pane on the right re-renders.
 */
export default function IntegrationsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SettingsShell>
      <div className="flex w-full flex-col gap-5 lg:flex-row lg:items-start">
        <IntegrationRail />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </SettingsShell>
  )
}
