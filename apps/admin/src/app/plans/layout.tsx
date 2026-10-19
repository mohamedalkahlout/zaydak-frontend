import { DashboardShell } from "@/shared/components/dashboard-shell";

export default function PlansLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
