"use client";

import Image from "@/shared/components/app-image";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { AppLogo } from "@/shared/components/app-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { SiteHeader as UiSiteHeader } from "@repo/ui/components/site-header";
import { UnsavedBar } from "@repo/ui/components/unsaved-bar";
import {
  CheckIcon,
  GlobeIcon,
  KeyRoundIcon,
  LogOutIcon,
  PlusCircleIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { NotificationsBell } from "@/features/notifications";
import { useSwitchShop } from "@/shared/hooks/use-switch-shop";
import { useAiChatStore } from "@/features/ai/store-chat";
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar";
import { navigateGuarded } from "@/shared/stores/leave-guard";
import { useLogout } from "@/shared/lib/auth/use-logout";
import { ThemeToggleButton } from "@repo/ui/components/theme-toggle-button";
import { useChangeLocale } from "@/shared/i18n/client";
import { LOCALE_LABELS } from "@/shared/i18n/config";
import { useTranslations } from "next-intl";
import { sileo } from "sileo";
import { cn } from "@/shared/lib/utils";
import { LanguageSelectDialog } from "@/features/skiper20";

interface Shop {
  id: string;
  name: string;
  slug: string;
  logo?: { id: string; original: string; thumbnail: string } | null;
  is_active: boolean;
  is_approved: boolean;
}

interface SiteHeaderProps {
  user?: {
    name?: string;
    email?: string;
  };
  shops?: Shop[];
}

/**
 * Vendor's top bar: the shared shell from `@repo/ui`, with this app's shop
 * switcher, AI toggle, notifications bell, and the contextual save bar wired to
 * `useUnsavedBarStore`.
 */
export function SiteHeader({ user, shops = [] }: SiteHeaderProps = {}) {
  const t = useTranslations("header");
  const router = useRouter();
  const params = useParams<{ shopSlug?: string }>();
  const switchShop = useSwitchShop();
  const aiChatOpen = useAiChatStore((s) => s.open);
  const aiChatUnread = useAiChatStore((s) => s.unread);
  const toggleAiChat = useAiChatStore((s) => s.togglePanel);
  const logout = useLogout();
  const { locale } = useChangeLocale();
  const unsavedActive = useUnsavedBarStore((s) => s.active);
  const unsavedLabel = useUnsavedBarStore((s) => s.label);
  const unsavedSaving = useUnsavedBarStore((s) => s.saving);
  const unsavedError = useUnsavedBarStore((s) => s.error);
  const unsavedErrorNonce = useUnsavedBarStore((s) => s.errorNonce);
  const unsavedOnSave = useUnsavedBarStore((s) => s.onSave);
  const unsavedOnDiscard = useUnsavedBarStore((s) => s.onDiscard);
  const unsavedDiscardHref = useUnsavedBarStore((s) => s.discardHref);

  const [isLangDialogOpen, setIsLangDialogOpen] = useState(false);

  // Only mark a shop as "active" when the URL slug matches. Falling back to
  // shops[0] would mislead the check-mark and label when the user is on a
  // page that doesn't belong to any of their shops.
  const activeShop = params.shopSlug
    ? shops.find((s) => s.slug === params.shopSlug)
    : undefined;

  // Every exit from this menu asks the leave guard first: it sits beside the
  // save bar, and a dirty settings form must not be dropped by the menu behind
  // it. The shop switch is held *whole* — `switchShop` owns the order (let the
  // link chain settle, write the active-shop store, then push), and splitting
  // it here would leave the header on one shop and the URL on another.
  function handleSelectShop(shop: Shop) {
    const href = `/store/${shop.slug}`;
    navigateGuarded(href, () => {
      void switchShop(shop.slug, { href });
    });
  }
  const goTo = (href: string) => navigateGuarded(href, () => router.push(href));

  const handleLogout = async () => {
    sileo.success({ title: t("loggedOut") });
    await logout();
  };
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";
  const displayName = user?.name || "User";
  const displayEmail = user?.email || "";

  return (
    <>
      <UiSiteHeader
        logo={
          <AppLogo
            variant="responsive"
            size="md"
            href={params?.shopSlug ? `/store/${params.shopSlug}` : "/store"}
            ariaLabel={t("home")}
          />
        }
        center={
          <>
            {/* Search — cross-fades out while the save bar is up. */}
            <div
              aria-hidden={unsavedActive}
              className={cn(
                "[grid-area:stack] relative min-w-0 transition-all duration-300 ease-out group",
                unsavedActive
                  ? "pointer-events-none -translate-y-2 opacity-0 scale-95"
                  : "translate-y-0 opacity-100 scale-100",
              )}
            >
              <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-white" />
              <Input
                type="search"
                placeholder={t("search")}
                aria-label={t("search")}
                tabIndex={unsavedActive ? -1 : 0}
                className="h-10 w-full min-w-0 rounded-xl border-zinc-700 bg-[#282828] ps-9 text-sm text-white placeholder:text-white focus-visible:border-zinc-500 focus-visible:ring-zinc-500/30"
              />
            </div>

            <UnsavedBar
              active={unsavedActive}
              label={unsavedLabel}
              saving={unsavedSaving}
              error={unsavedError}
              errorNonce={unsavedErrorNonce}
              onSave={unsavedOnSave}
              onDiscard={unsavedOnDiscard}
              discardHref={unsavedDiscardHref}
              labels={{
                discard: t("discard"),
                save: t("save"),
                saving: t("saving"),
                retry: t("retry"),
              }}
            />
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-lg"
              className={cn(
                "relative text-white/70",
                aiChatOpen && "bg-white/15 text-white",
              )}
              onClick={toggleAiChat}
              aria-pressed={aiChatOpen}
              aria-controls="ai-chat-panel"
              aria-label={
                aiChatUnread && !aiChatOpen
                  ? t("aiAssistantUnread")
                  : t("aiAssistant")
              }
            >
              <SparklesIcon className="size-4" />
              {aiChatUnread && !aiChatOpen ? (
                <span
                  className="absolute top-2 end-2 size-2 rounded-full bg-violet-400"
                  aria-hidden
                />
              ) : null}
            </Button>
            <NotificationsBell />
          </>
        }
        userMenu={
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 ml-2 rounded-lg md:py-1 md:pl-1 md:pr-2 hover:bg-white/10 aria-expanded:bg-white/15 outline-none cursor-pointer">
              <Avatar size="default">
                <AvatarFallback className="rounded-lg! bg-green-600 text-white text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm font-medium text-white/90">
                {displayName}
              </span>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={18}
              className="w-64 shadow-xl"
            >
              {/* Shops list */}
              {shops.map((shop) => {
                const isActive = shop.id === activeShop?.id;
                const shopInitials = shop.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <DropdownMenuItem
                    key={shop.id}
                    onClick={() => handleSelectShop(shop)}
                    className="flex items-center gap-3 py-2"
                  >
                    <Avatar size="sm">
                      {shop.logo?.thumbnail ? (
                        <Image
                          src={shop.logo.thumbnail}
                          alt={shop.name}
                          width={32}
                          height={32}
                          className="rounded-lg object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-green-600 text-white text-xs font-semibold">
                          {shopInitials}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">{shop.name}</span>
                      {!shop.is_approved && (
                        <span className="text-xs text-amber-500">
                          {t("pendingApproval")}
                        </span>
                      )}
                    </div>
                    {isActive && <CheckIcon className="ms-auto size-4 shrink-0" />}
                  </DropdownMenuItem>
                );
              })}

              {/* Create store */}
              <DropdownMenuItem
                onClick={() => goTo("/create-store")}
                className="flex items-center gap-3 py-2"
              >
                <PlusCircleIcon className="size-5 text-muted-foreground" />
                <span>{t("createStore")}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* User info */}
              <DropdownMenuItem className="flex items-center gap-3 py-2">
                <Avatar size="sm">
                  <AvatarFallback className="bg-amber-600 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{displayName}</span>
                  {displayEmail && (
                    <span className="text-xs text-muted-foreground">
                      {displayEmail}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Theme toggle — the animated switch button, drives the whole app
                  via the View Transitions API */}
              <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                <span className="text-sm">{t("theme")}</span>
                <ThemeToggleButton
                  variant="circle"
                  start="top-right"
                  className="size-7"
                />
              </div>

              {/* Language */}
              <DropdownMenuItem
                onClick={() => setIsLangDialogOpen(true)}
                className="flex items-center gap-3 py-2"
              >
                <GlobeIcon className="size-4 text-muted-foreground" />
                <span>{t("language")}</span>
                <span className="ms-auto text-xs text-muted-foreground">
                  {LOCALE_LABELS[locale]}
                </span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Change password */}
              <DropdownMenuItem
                onClick={() => goTo("/store/change-password")}
                className="flex items-center gap-3 py-2"
              >
                <KeyRoundIcon className="size-4 text-muted-foreground" />
                <span>{t("changePassword")}</span>
              </DropdownMenuItem>

              {/* Log out */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-3 py-2"
              >
                <LogOutIcon className="size-4 text-muted-foreground" />
                <span>{t("logOut")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <LanguageSelectDialog
        isOpen={isLangDialogOpen}
        onClose={() => setIsLangDialogOpen(false)}
      />
    </>
  );
}
