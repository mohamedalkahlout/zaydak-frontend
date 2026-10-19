"use client"

import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar"

import { AppSidebar } from "@/shared/components/app-sidebar"
import { SiteHeader } from "@/shared/components/site-header"
import { useBfcacheAuthGuard } from "@/shared/auth/use-bfcache-guard"

interface DashboardShellProps {
  user?: { name?: string; email?: string }
  children: React.ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  useBfcacheAuthGuard()

  return (
    // `h-svh` pins the shell to the viewport; the children area scrolls
    // internally so the header and sidebar stay parked.
    <SidebarProvider className="flex h-svh flex-col bg-black [--header-height:calc(--spacing(16))]">
      <SiteHeader user={user} />
      <div className="flex min-h-0 flex-1 flex-row rounded-t-2xl overflow-hidden">
        <AppSidebar />
        <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden gap-1">
          <SidebarInset className="min-h-0 bg-background dark:bg-[#1a1a1a] rounded-b-none rounded-ss-none rounded-se-2xl overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto flex gap-1 h-full">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
                {children}
              </div>
            </div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  )
}
