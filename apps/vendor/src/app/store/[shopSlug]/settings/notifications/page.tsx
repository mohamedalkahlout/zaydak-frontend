import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  NOTIFICATION_CATALOG,
  NOTIFICATION_SETTING,
} from "@/features/notifications/api"
import { NotificationsSettings } from "@/features/notifications"

/**
 * Both of the screen's queries start on the server, so the landing menu and
 * the sender email card stream with data rather than a spinner the client
 * replaces — preload + `useSuspenseQuery`, same shape as the storefront.
 */
export default function SettingsNotificationsPage() {
  return (
    <PreloadQuery query={NOTIFICATION_SETTING}>
      <PreloadQuery query={NOTIFICATION_CATALOG}>
        <Suspense fallback={<NotificationsSkeleton />}>
          <NotificationsSettings />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-14 w-full rounded-lg" />
      </div>
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
