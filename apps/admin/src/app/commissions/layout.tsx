import { DashboardShell } from "@/shared/components/dashboard-shell";

export default function CommissionsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
