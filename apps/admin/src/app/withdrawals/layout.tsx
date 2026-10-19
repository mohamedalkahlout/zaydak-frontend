import { DashboardShell } from "@/shared/components/dashboard-shell";

export default function WithdrawalsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
