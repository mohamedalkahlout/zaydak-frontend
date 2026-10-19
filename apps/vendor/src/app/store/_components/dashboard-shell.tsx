"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSuspenseQuery } from "@apollo/client/react";
import { GET_ME } from "@/features/auth/api";
import { GET_MY_SHOPS } from "@/features/shops/api";
import type { GetMeResponse } from "@/features/auth/types";
import type { MyShopsResponse } from "@/features/shops/types";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { EmailVerificationBanner } from "@/shared/components/email-verification-banner";
import { LeaveGuardDialog } from "@/shared/components/leave-guard-dialog";
import { SiteHeader } from "@/shared/components/site-header";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { getCookie } from "@/shared/lib/cookies";
import { ACCESS_TOKEN_KEY } from "@/shared/lib/apollo/links";
import { isOverlayRoute } from "@/shared/lib/overlay-routes";
import { useAiChatStore } from "@/features/ai/store-chat";

// The AI panel pulls in WebGL shaders (@paper-design/shaders-react), motion, and
// the streaming chat client. Code-split it so that weight stays off the shared
// dashboard bundle, and only mount it the first time the user opens the panel —
// sessions that never use the assistant never download the chunk, create a WebGL
// context, or fire the conversation-history fetch.
const AiChatPanel = dynamic(
  () =>
    import("@/features/ai/components/ai-chat-panel").then((m) => m.AiChatPanel),
  { ssr: false },
);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !getCookie(ACCESS_TOKEN_KEY)) {
        // Full reload is intentional: bfcache restored a stale authed view.
        window.location.href = "/login";
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const { data } = useSuspenseQuery<GetMeResponse>(GET_ME);
  const { data: shopsData } = useSuspenseQuery<MyShopsResponse>(GET_MY_SHOPS);
  const user = data?.me?.data;
  const shops = shopsData?.myShops?.data ?? [];

  // A sheet (settings, the store-import review) covers the sidebar without
  // unmounting it, so Tab and a screen reader would still walk a navigation
  // nobody can see. `inert` takes it out of both while a sheet URL is on
  // screen; read off the path for the reason `overlay-routes` gives.
  const pathname = usePathname();
  const overSheet = isOverlayRoute(pathname);

  // Latch on first open, then keep the panel mounted so its open/close
  // animation stays smooth. Setting state during render with a guard is the
  // supported React pattern (no effect, no extra commit).
  const aiChatOpen = useAiChatStore((s) => s.open);
  const [aiPanelMounted, setAiPanelMounted] = useState(false);
  if (aiChatOpen && !aiPanelMounted) setAiPanelMounted(true);

  return (
    // `h-svh` pins the shell to the viewport. Children-area scrolls internally
    // so the header and sidebar stay parked (no sticky tricks required).
    <SidebarProvider className="flex h-svh flex-col bg-black [--header-height:calc(--spacing(16))]">
      <SiteHeader user={user} shops={shops} />
      {/* One prompt for every screen that arms `useLeaveGuard`, mounted once
          beside the header that carries the save bar it belongs to — so the
          next editing screen adopts it without a second copy. */}
      <LeaveGuardDialog />
      <div className="flex min-h-0 flex-1 flex-row rounded-t-2xl overflow-hidden">
        <AppSidebar inert={overSheet} />
        {/* `relative` anchors the AI panel, which overlays this area —
            it slides in over the content instead of pushing it. */}
        <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden gap-1">
          {/*
            Square against the nav (`rounded-ss-none`). Round the trailing
            top edge (`rounded-se-2xl`): outer viewport when Sidekick is
            closed, the gap beside the panel when `useAiChatStore().open`.
            Logical on purpose — physical `rounded-tl`/`rounded-tr` put the
            radius on the logo-adjacent corner in Arabic.
          */}
          <SidebarInset className="min-h-0 bg-background dark:bg-[#1a1a1a] rounded-b-none rounded-ss-none rounded-se-2xl overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto flex gap-1 h-full">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
                {user && user.email_verified === false ? (
                  <EmailVerificationBanner />
                ) : null}
                {children}
              </div>
            </div>
          </SidebarInset>
          {aiPanelMounted && (
            <AiChatPanel userName={user?.name?.split(" ")[0]} />
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
