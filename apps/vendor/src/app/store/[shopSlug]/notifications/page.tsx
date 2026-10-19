import { NotificationsPage } from "@/features/notifications/components/notifications-page"

export default async function Page({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return <NotificationsPage />
}
