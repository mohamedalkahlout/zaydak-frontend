import { DashboardShell } from "@/shared/components/dashboard-shell"

/**
 * A record list like `/users`, not a settings form — so it renders in the
 * dashboard shell with the sidebar, rather than in the `SettingsShell` that
 * holds the OTP settings screen. A seven-column table would not fit that
 * shell's `max-w-3xl` column anyway.
 */
export default function OtpLogsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>
}
