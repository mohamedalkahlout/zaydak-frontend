import { ReportBuilder } from "@/features/reports"

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return <ReportBuilder />
}
