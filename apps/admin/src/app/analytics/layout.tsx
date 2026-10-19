import { DashboardShell } from "@/shared/components/dashboard-shell";

export default function AnalyticsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
