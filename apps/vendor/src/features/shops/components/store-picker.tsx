"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "@/shared/components/app-image"
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { sileo } from "sileo";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  KeyRoundIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { GET_MY_SHOPS } from "@/features/shops/api";
import type { MyShopsResponse, Shop } from "@/features/shops/types";
import { temporaryStoreHint } from "@/features/shops/lib/temporary-store";
import { GET_ME } from "@/features/auth/api";
import type { GetMeResponse } from "@/features/auth/types";
import { useSwitchShop } from "@/shared/hooks/use-switch-shop";
import { useLogout } from "@/shared/lib/auth/use-logout";
import { useChangeLocale } from "@/shared/i18n/client";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/shared/i18n/config";
import { StoreFrame } from "@/features/shops/components/store-frame";

/**
 * The storefront origin a shop is reachable at. It is the second line of every
 * row (our equivalent of `acme.myshopify.com`), so a vendor holding three
 * stores all named "My Store" can still tell them apart.
 */
const STOREFRONT_HOST = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3003"
).replace(/^https?:\/\//, "");

type ShopFilter = "all" | "active" | "inactive";

const FILTERS = ["all", "active", "inactive"] as const;

/**
 * Menu items on this screen spell their colours out instead of reading the
 * theme tokens: the picker paints its own ground and is the same picture in
 * light and dark (see `StoreFrame`), but a menu popup portals out of it and
 * would otherwise take whatever theme the dashboard last set.
 */
const LIGHT_MENU_ITEM =
  "px-2.5 py-1.5 text-zinc-900 focus:bg-zinc-100 focus:text-zinc-900";

/**
 * A shop is "active" only when the platform has approved it *and* the
 * storefront switch is on. The two flags gate different things, and either one
 * being off means nobody can shop there.
 */
function isActive(shop: Shop) {
  return shop.is_approved && shop.is_active;
}

function initialsOf(name: string) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 3);
  return letters ? letters.toLowerCase() : "s";
}

/**
 * Where a keystroke is already spoken for, so the global search shortcut must
 * leave it alone: anything the vendor is typing into, and any open menu or
 * dialog (Base UI portals those out of the card, so a DOM-ancestry check on
 * the card itself would not see them — the roles are what survive the portal).
 */
function isKeystrokeClaimed(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return (
    target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="menu"], [role="dialog"], [role="listbox"]',
    ) !== null
  );
}

/**
 * The store picker: the greeting, the account menu, and one scrollable list of
 * the vendor's stores with a status filter and a search box above it and the
 * create-store row pinned below.
 *
 * Keyboard model: `/` (or Cmd/Ctrl+K) from anywhere on the page lands in the
 * search box; ArrowDown from the box enters the list; the arrows walk the rows,
 * Home/End jump, and ArrowUp on the first row goes back to the box — that is
 * where people came from, so wrapping to the bottom would strand them.
 */
export function StorePicker() {
  const router = useRouter();
  const t = useTranslations("shops");
  const tHeader = useTranslations("header");
  const switchShop = useSwitchShop();
  const logout = useLogout();
  const { locale, change: changeLocale } = useChangeLocale();

  const [filter, setFilter] = useState<ShopFilter>("all");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { data, loading } = useQuery<MyShopsResponse>(GET_MY_SHOPS);
  const { data: meData } = useQuery<GetMeResponse>(GET_ME);

  const shops = useMemo(() => data?.myShops?.data ?? [], [data]);

  const user = meData?.me?.data;
  const nameParts = (user?.name ?? "").split(" ").filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const userInitials =
    nameParts
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return shops.filter((shop) => {
      if (filter === "active" && !isActive(shop)) return false;
      if (filter === "inactive" && isActive(shop)) return false;
      if (!term) return true;
      return (
        shop.name.toLowerCase().includes(term) ||
        shop.slug.toLowerCase().includes(term)
      );
    });
  }, [shops, filter, search]);

  // The search shortcut listens on `window` so it works wherever focus sits —
  // on a row, on the create button, on nothing at all after a click on the
  // ground. It reads the ref inside the handler, so the effect depends on
  // nothing and is registered once.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const slash =
        event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      // Matched on the physical key as well: under an Arabic layout `key` is
      // the Arabic letter on that cap, and the chord is still Cmd+K.
      const commandK =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (event.code === "KeyK" || event.key.toLowerCase() === "k");
      if (!slash && !commandK) return;
      // A `/` typed into the box is a `/` — the box already has focus and the
      // vendor may be searching for a handle with one in it.
      if (isKeystrokeClaimed(event.target)) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** The row buttons, in list order — the hint links beside them are skipped. */
  const rowButtons = () =>
    Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-shop]") ??
        [],
    );

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      const first = rowButtons()[0];
      if (!first) return;
      event.preventDefault();
      first.focus();
    } else if (event.key === "Escape") {
      // Escape clears first and leaves second: a vendor who typed the wrong
      // thing wants the whole list back before they want their focus gone.
      if (search) {
        event.preventDefault();
        setSearch("");
      } else {
        event.currentTarget.blur();
      }
    }
  };

  // Roving arrow-key navigation over the rows, mirroring the create-product
  // dialog: Tab already reaches every row, but in a list of sibling actions
  // up/down is what people reach for. Enter and Space are native activation.
  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = rowButtons();
    if (rows.length === 0) return;
    event.preventDefault();
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Home") {
      rows[0]?.focus();
    } else if (event.key === "End") {
      rows[rows.length - 1]?.focus();
    } else if (event.key === "ArrowDown") {
      rows[current === -1 ? 0 : (current + 1) % rows.length]?.focus();
    } else if (current <= 0) {
      // First row (or a hint link beside one): back to the box, not the end.
      searchRef.current?.focus();
    } else {
      rows[current - 1]?.focus();
    }
  };

  // Not `setSlug` + `push`: writing the active-shop store is what clears the
  // Apollo cache, and a clear that lands on this screen's own in-flight
  // `myShops`/`me` reads cancels them. `switchShop` waits for the chain to go
  // idle first, and keeps the store-before-URL order the X-SHOP link needs.
  function selectShop(shop: Shop) {
    void switchShop(shop.slug);
  }

  const handleLogout = async () => {
    sileo.success({ title: tHeader("loggedOut") });
    await logout();
  };

  const filterLabels: Record<ShopFilter, string> = {
    all: t("filter.all"),
    active: t("filter.active"),
    inactive: t("filter.inactive"),
  };

  return (
    <StoreFrame
      title={firstName ? t("welcomeBack", { name: firstName }) : t("welcome")}
      subtitle={t("subtitle")}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("accountMenu")}
            className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/10 aria-expanded:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/15 text-xs font-semibold text-white">
              {userInitials}
            </span>
            <span className="hidden text-sm font-medium text-white sm:block">
              {user?.name ?? ""}
            </span>
            <ChevronDownIcon className="size-4 text-white/60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 bg-white text-zinc-900 ring-zinc-200"
          >
            {/* Who is signed in — the answer to "is this the right account"
                before any of the actions below it. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 py-2">
                <span className="block truncate text-sm font-semibold text-zinc-900">
                  {user?.name ?? ""}
                </span>
                <span className="block truncate text-xs font-normal text-zinc-500">
                  {user?.email ?? ""}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-zinc-200" />

            <DropdownMenuItem
              onClick={() => router.push("/store/change-password")}
              className={cn(LIGHT_MENU_ITEM, "gap-2.5")}
            >
              <KeyRoundIcon className="size-4 text-zinc-500" />
              {tHeader("changePassword")}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-200" />

            {/* Every auth screen has a locale switch and the dashboard header
                has one; the picker sits between them and had none. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 text-zinc-500">
                {tHeader("language")}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={locale}
                onValueChange={(next) => changeLocale(next as SupportedLocale)}
              >
                {SUPPORTED_LOCALES.map((option) => (
                  <DropdownMenuRadioItem
                    key={option}
                    value={option}
                    closeOnClick
                    className={LIGHT_MENU_ITEM}
                  >
                    {LOCALE_LABELS[option]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-zinc-200" />

            {/* "Switch account" is log out then sign in; one item covers it. */}
            <DropdownMenuItem
              onClick={() => void handleLogout()}
              className={cn(LIGHT_MENU_ITEM, "gap-2.5")}
            >
              <LogOutIcon className="size-4 text-zinc-500" />
              {tHeader("logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* Filter + search */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("filter.label")}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-zinc-100 px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          >
            {filterLabels[filter]}
            <ChevronDownIcon className="size-4 text-zinc-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-40 bg-white text-zinc-900 ring-zinc-200"
          >
            {FILTERS.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => setFilter(option)}
                className={cn(LIGHT_MENU_ITEM, "justify-between")}
              >
                {filterLabels[option]}
                {filter === option && <CheckIcon className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            aria-keyshortcuts="/"
            className="h-11 w-full rounded-xl bg-zinc-100 ps-10 pe-10 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-500 hover:bg-zinc-200/70 focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 [&::-webkit-search-cancel-button]:hidden"
          />
          {/* The shortcut badge; decoration, so out of the accessible name, and
              gone once there is text — that is where the text ends. */}
          {!search && (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-200 bg-white px-1.5 font-sans text-[10px] leading-4 text-zinc-500 sm:block"
            >
              /
            </kbd>
          )}
        </div>
      </div>

      {/* The list is capped so the create row stays in view, and the mask
              fades the last visible row so it reads as scrollable, not clipped. */}
      <div
        className={cn(
          "mt-4 max-h-76 overflow-y-auto",
          filtered.length > 5 &&
            "[mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]",
        )}
      >
        {loading ? (
          <ul className="animate-pulse">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-b border-zinc-200 py-3.5"
              >
                <span className="size-10 rounded-xl bg-zinc-200" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3.5 w-32 rounded bg-zinc-200" />
                  <span className="block h-3 w-48 rounded bg-zinc-100" />
                </span>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-10 text-center text-sm text-zinc-500">
            {shops.length === 0 ? t("empty") : t("noMatches")}
          </p>
        ) : (
          <ul ref={listRef} onKeyDown={onListKeyDown}>
            {filtered.map((shop) => {
              const active = isActive(shop);
              const hint = temporaryStoreHint(shop);
              return (
                // The row is one button and the setup hint is a link, and a
                // link inside a button is invalid HTML — so the two are
                // siblings, and the border that used to be the button's is
                // the row's.
                <li
                  key={shop.id}
                  className="flex items-center gap-2 border-b border-zinc-200"
                >
                  <button
                    type="button"
                    data-shop={shop.id}
                    onClick={() => selectShop(shop)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3.5 text-start transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-900"
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-semibold",
                        active
                          ? "bg-[#00b140] text-white"
                          : "bg-zinc-200 text-zinc-500",
                      )}
                    >
                      {shop.logo?.thumbnail ? (
                        <Image
                          src={shop.logo.thumbnail}
                          alt=""
                          width={40}
                          height={40}
                          className="size-10 object-cover"
                        />
                      ) : (
                        initialsOf(shop.name)
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">
                        {shop.name}
                      </span>
                      <span className="block truncate text-sm text-zinc-500">
                        {STOREFRONT_HOST}/{shop.slug}
                      </span>
                    </span>

                    {/* Why a store is not active is worth saying: waiting
                            on approval and suspended are different problems. */}
                    {!active && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          shop.is_approved
                            ? "bg-zinc-100 text-zinc-500"
                            : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {shop.is_approved ? t("suspended") : t("pending")}
                      </span>
                    )}
                  </button>

                  {/* A store still carrying the name or handle creation gave
                      it gets one link to the pane that changes it. Styled as
                      an ink chip, not a second amber pill: a fresh store is
                      also unapproved, and two amber pills on a row read as
                      one status rather than a status and a thing to do. */}
                  {hint && (
                    <Link
                      href={`/store/${shop.slug}/settings/${hint === "name" ? "general" : "domains"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        void switchShop(shop.slug, {
                          href: `/store/${shop.slug}/settings/${hint === "name" ? "general" : "domains"}`,
                        });
                      }}
                      title={
                        hint === "name"
                          ? t("hint.nameTitle", { name: shop.name })
                          : t("hint.handleTitle")
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-900 py-0.5 ps-2.5 pe-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    >
                      {t(`hint.${hint}`)}
                      <ArrowUpRightIcon className="size-3 rtl:-scale-x-100" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => router.push("/create-store")}
        className="group mt-2 flex w-full items-center gap-3 rounded-xl py-3.5 text-start transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-900"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-transform group-hover:scale-105">
          <PlusIcon className="size-5" />
        </span>
        <span className="text-sm font-semibold text-zinc-900">
          {t("createStore")}
        </span>
      </button>
    </StoreFrame>
  );
}
