"use client"

import { useEffect, useMemo } from "react"
import Image from "@/shared/components/app-image"
import Link from "next/link"
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ChevronRight, X } from "lucide-react"
import { GET_MY_SHOPS } from "@/features/shops/api"
import { GET_ME } from "@/features/auth/api"
import { SettingsRail } from "@repo/ui/components/settings-rail"
import { navigateGuarded } from "@/shared/stores/leave-guard"
import { SETTINGS_SECTIONS } from "./settings-sections"
import type { SettingsSectionId } from "./settings-sections"
import {
  SettingsHeaderSlotsProvider,
  useSettingsHeaderSlotTargets,
} from "./settings-header-slots"
import { parseSettingsPath, sectionUrl } from "../lib/routes"
import type { MyShopsSettingsResponse } from "../types"

type MeResponse = {
  me: { data?: { name?: string | null; email?: string | null } | null }
}

function initialsOf(name?: string | null) {
  if (!name) return "S"
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/**
 * The settings overlay's frame: the rail, the heading and the way out.
 *
 * It is a **layout**, so it survives navigation between sections — the rail's
 * filter box keeps its text and only the pane re-renders, which is the same
 * reason the admin console's integrations rail lives in a layout rather than in
 * its page.
 *
 * Which section is active is read from the pathname rather than held in state.
 * A second copy of "where am I" is a second thing that can lag a navigation.
 */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const pathname = usePathname()
  // Legal here: `settings/layout.tsx` already wraps the shell in `<Suspense>`,
  // which a statically rendered route needs above `useSearchParams`.
  const search = useSearchParams()
  const router = useRouter()
  const t = useTranslations("settings")
  const tNav = useTranslations("settings.nav")
  const tGeneral = useTranslations("settings.general")

  const { data: shopsData } = useSuspenseQuery<MyShopsSettingsResponse>(
    GET_MY_SHOPS,
  )
  const { data: meData } = useSuspenseQuery<MeResponse>(GET_ME)
  const shops = shopsData?.myShops?.data ?? []
  const shop = shopSlug
    ? (shops.find((s) => s.slug === shopSlug) ?? shops[0])
    : shops[0]
  const user = meData?.me?.data

  const { section, subview, detail } = parseSettingsPath(pathname)

  // Where a page mounts its own header content — see `settings-header-slots`.
  const { slots, setTitle, setActions } = useSettingsHeaderSlotTargets()

  // The X and Escape push rather than click a link, so the leave guard's click
  // listener never sees them; asking it here is what stops the overlay's own
  // way out from dropping a dirty General form.
  const close = () => {
    const target = shopSlug ? `/store/${shopSlug}` : "/store"
    navigateGuarded(target, () => router.push(target))
  }

  // Escape closes the overlay (Shopify parity). It stands down while a dialog
  // is mounted — the address editor's own Escape has to close the dialog, not
  // throw the vendor off the screen behind it. The leave guard's prompt is a
  // dialog too, so Escape there means "stay" rather than a second exit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (document.querySelector("[data-slot=dialog-content]")) return
      // The assistant panel now opens *over* this overlay rather than behind
      // it, and Escape is its dismissal too. Its listener is on `document` and
      // ours on `window`, so it runs first and the DOM here still carries the
      // pre-commit attributes — without this, one press would close the panel
      // and throw the vendor off the screen it was opened to talk about.
      if (document.querySelector("#ai-chat-panel:not([inert])")) return
      close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSlug])

  // The path is the address. A `?section=` on a sub-route is a leftover from
  // the one-route era — the index page still translates it — and on a URL that
  // already names its section it is dropped rather than obeyed, or the address
  // bar advertises a pane that is not the one on screen. `section` is null on
  // the bare `/settings` root, so the index page's redirect is untouched, and
  // only `section` is deleted: `?billing=` and the rest are carried.
  useEffect(() => {
    if (!section || !search.has("section")) return
    const next = new URLSearchParams(search)
    next.delete("section")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [section, search, pathname, router])

  // The rail owns its own filter box; what it is handed is every section with
  // its label already translated and the active one flagged.
  const navItems = useMemo(
    () =>
      SETTINGS_SECTIONS.map((s) => ({
        id: s.id,
        label: tNav(s.id),
        icon: s.icon,
        active: s.id === section,
      })),
    [section, tNav],
  )

  const activeSection = SETTINGS_SECTIONS.find((s) => s.id === section)

  return (
    // `fixed … z-40`, and the AI panel has to be able to get above it: asking
    // the assistant about a screen must not close that screen. The panel keys
    // off the path (`SETTINGS_OVERLAY_PATH` in `features/ai/components/
    // ai-chat-panel`) and swaps to this same `top-(--header-height) bottom-0`
    // band at `z-45` while a settings URL is on screen — so if these routes
    // ever move, that pattern moves with them.
    <div className="fixed inset-x-0 rounded-t-xl scrollbar-none bottom-0 top-(--header-height) z-40 overflow-y-auto bg-[#f1f1f1]">
      <button
        type="button"
        onClick={close}
        aria-label={t("close")}
        className="absolute end-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <X className="size-5" />
      </button>

      {/* 1120px rather than 1040: wide enough for a detail heading (hostname,
          pill, "Managed by … · Added on …") to share its row with three
          actions, as the reference does, instead of wrapping them under it. */}
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 py-6 lg:flex-row lg:items-start">
        {/*
          Left rail — the shared card from `@repo/ui`, the same one the admin
          console's integrations screen draws. Links, not buttons: every entry
          is a real URL, so the browser gets middle-click, open-in-new-tab and
          Back for free, none of which a `setActive` handler could offer. The
          rail itself is agnostic about that; it renders whatever `renderItem`
          returns.
        */}
        <SettingsRail
          className="lg:top-6"
          title={shop?.name ?? t("title")}
          subtitle={shop?.slug}
          badge={
            shop?.logo?.thumbnail ? (
              <Image
                src={shop.logo.thumbnail}
                alt={shop?.name ?? ""}
                width={36}
                height={36}
                className="size-full object-cover"
              />
            ) : (
              initialsOf(shop?.name)
            )
          }
          items={navItems}
          renderItem={(item, props) => (
            <Link
              href={sectionUrl(shopSlug, item.id as SettingsSectionId)}
              {...props}
            />
          )}
          searchPlaceholder={t("searchNav")}
          emptyLabel={t("noNavMatch")}
          footer={
            user ? (
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-semibold text-white">
                  {initialsOf(user.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  {user.email && (
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            ) : null
          }
        />

        {/* Content */}
        <main className="min-w-0 flex-1">
          <SettingsHeaderSlotsProvider value={slots}>
            {/*
              The header row. Its left half is derived from the path — the
              section's icon and name, or a breadcrumb back to it — and its
              right half is a mount point the page fills (`SettingsHeaderActions`).
              On a detail screen the heading is a mount point too: the page
              knows what record it is showing and the shell does not.
            */}
            {/* `pe-9` keeps the page's actions out from under the overlay's X on
                widths where the content column reaches the viewport edge. */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pe-9 xl:pe-0">
              {/* `basis-[22rem]`: the heading block keeps room for a hostname and
                  its "Managed by … · Added on …" line; when a page's actions do
                  not fit beside that they wrap under it rather than squeeze it. */}
              <div className="flex min-w-0 flex-1 basis-[22rem] items-start gap-2">
                {detail && section ? (
                  <>
                    <Link
                      href={sectionUrl(shopSlug, section)}
                      aria-label={tNav(section)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
                    >
                      {activeSection && <activeSection.icon className="size-5" />}
                    </Link>
                    <ChevronRight className="mt-1.5 size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                    <div
                      ref={setTitle}
                      data-slot="settings-header-title"
                      className="min-w-0 flex-1"
                    />
                  </>
                ) : subview ? (
                  <>
                    <Link
                      href={sectionUrl(shopSlug, "general")}
                      aria-label={tNav("general")}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
                    >
                      {activeSection && <activeSection.icon className="size-5" />}
                    </Link>
                    <ChevronRight className="mt-1.5 size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                    <h1 className="font-heading text-xl font-semibold">
                      {tGeneral(subview === "brand" ? "brand" : "contactDetails")}
                    </h1>
                  </>
                ) : (
                  <>
                    {activeSection && (
                      <activeSection.icon className="mt-1 size-5 shrink-0 text-muted-foreground" />
                    )}
                    <h1 className="font-heading text-xl font-semibold">
                      {section ? tNav(section) : t("title")}
                    </h1>
                  </>
                )}
              </div>
              <div
                ref={setActions}
                data-slot="settings-header-actions"
                className="ms-auto flex shrink-0 flex-wrap items-center gap-2 empty:hidden"
              />
            </div>

            {children}
          </SettingsHeaderSlotsProvider>
        </main>
      </div>
    </div>
  )
}

/** The shop the overlay is scoped to, for a pane that needs more than the frame. */
export function useSettingsShop() {
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const { data } = useSuspenseQuery<MyShopsSettingsResponse>(GET_MY_SHOPS)
  const shops = data?.myShops?.data ?? []
  return shopSlug
    ? (shops.find((s) => s.slug === shopSlug) ?? shops[0])
    : shops[0]
}

