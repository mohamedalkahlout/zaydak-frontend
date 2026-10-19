import { DashboardShell } from "@/shared/components/dashboard-shell"

export default function PaymentFeesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>
}
