"use client"

import Link from "next/link"
import Image from "@/shared/components/app-image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  Globe,
  Heart,
  Home,
  LogOut,
  MapPin,
  Receipt,
  Search,
  ShoppingBag,
  Store,
  User,
} from "lucide-react"
import { sileo } from "sileo"
import NumberFlow from "@number-flow/react"

import {
  Avatar,
  AvatarFallback,
} from "@repo/ui/components/avatar"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@repo/ui/lib/utils"

import { LocaleSegmented } from "@/shared/components/locale-switcher"
import { CurrencySwitcher } from "@/shared/components/currency-switcher"
import { MULTI_CURRENCY_ENABLED } from "@/shared/lib/currency/currency-presets"
import {
  NOTCH_GHOST,
  NotchNav,
  type NotchItemData,
} from "@/shared/components/notch-nav"
import { resolveLocale } from "@/shared/i18n/config"
import { clearAuthSession } from "@/shared/auth/session"
import { useAuthDialogStore } from "@/shared/stores/auth-dialog"
import { useCartDrawerStore } from "@/shared/stores/cart-drawer"
import { useCartFlightStore } from "@/shared/stores/cart-flight"
import { useCart } from "@/features/cart/use-cart"
import { CartPanel } from "@/features/cart/components/cart-panel"
import { useCurrentUser } from "@/features/auth/use-current-user"
import type { CurrentUser } from "@/shared/stores/auth"
import { useShop } from "../shop-context"
import { shopHomeHref } from "@/shared/lib/tenant"

/**
 * The storefront header, worn as a **notch**.
 *
 * Deliberately *not* `@repo/ui`'s `SiteHeader`: that one is the consoles'
 * chrome — a breadcrumb rail with a sidebar toggle. A shop needs the opposite
 * three things at all times (who this shop is, a way to search it, and the
 * cart), and the shop identity has to be a link home rather than a static
 * title.
 *
 * It used to be one full-width bar in two skins — transparent over the home
 * hero, solid everywhere else — and the second skin is gone with the bar. Three
 * slabs cut out of the top edge (`shared/components/notch-nav.tsx`) carry their
 * own ground at every width — white in light mode, near-black in dark —
 * which is what removes the whole class of problem the `floating` skin existed
 * to manage: white ink that had to fade back to page ink on the first scroll,
 * or vanish. Every control here reads `--shop-notch-ink` rather than a fixed
 * colour, so the slab's ground is retuned in `globals.css` alone.
 *
 * The bar is `fixed`, so `ShopShell` reserves its height — on **every** route,
 * with no exception. There used to be one: the home page's cloud-shader hero
 * was full-bleed sky drawn deliberately behind the slabs, and `useShopChrome`
 * existed so the page and the bar could not disagree about it. That hero now
 * opens the marketplace directory (`/`) instead.
 *
 * What leads the shop home is `HomeHero`, and it *is* full-bleed artwork — but
 * it sizes itself to `calc(100svh - 4rem)` and begins under the reserved
 * height rather than behind the bar. So the condition stays gone: the bar is
 * never asked to sit on a vendor's cover photo, whose exposure nothing here
 * controls, and there is still only one answer for every route.
 *
 * **Every link to a guarded route carries `prefetch={false}`,** and that is not
 * a performance choice. `/account` and `/wishlist` need a session, so `proxy.ts`
 * answers a signed-out prefetch of either with a redirect to `/login` — and
 * Next caches that resolution against the URL. Sign in afterwards and the
 * client router still has "this URL means login" on file, which is what made
 * `router.replace("/{slug}/account")` bounce straight back to the sign-in
 * screen. `login-form.tsx` navigates hard for the same reason; this stops the
 * poisoned entry being written in the first place.
 */

/**
 * The badge's digits roll rather than swap. 300ms is short enough that a
 * shopper adding three things quickly sees three distinct moves instead of one
 * smear, and long enough to be read as the number *changing* rather than as a
 * repaint.
 */
const COUNT_TIMING = { duration: 300 } as const

/** A row in the dropdown panel that is not one of the nav entries. */
const PANEL_ROW =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm text-shop-notch-muted transition-colors hover:bg-shop-notch-pill/60 hover:text-shop-notch-ink"

export function ShopHeader() {
  const t = useTranslations("shop")
  const tCatalog = useTranslations("catalog")
  const { slug, base, shop } = useShop()
  const pathname = usePathname()

  const current = pathname.replace(/\/$/, "")

  const items: NotchItemData[] = [
    { id: "home", label: t("home"), href: shopHomeHref(base), icon: Home },
    {
      id: "products",
      label: t("allProducts"),
      href: `${base}/products`,
      icon: Store,
    },
  ]

  // Derived from the URL rather than held in state: the slabs are mounted above
  // every route, so a stored "active tab" would be one render behind every
  // navigation the shopper makes from inside a page.
  const activeId = current.startsWith(`${base}/products`)
    ? "products"
    : current === base
      ? "home"
      : ""

  return (
    <NotchNav
      items={items}
      activeId={activeId}
      label={t("menu")}
      menuLabel={t("menu")}
      logo={<ShopBrand name={shop?.name ?? slug} />}
      rightContent={<HeaderActions slug={slug} />}
      drawer={
        <HeaderSearch
          placeholder={tCatalog("searchPlaceholder")}
          className="mb-1"
        />
      }
      drawerFooter={<PanelFooter slug={slug} />}
    />
  )
}

/** Shop identity — always a link home. */
function ShopBrand({ name }: { name: string }) {
  const { base, shop } = useShop()
  const logo = shop?.logo?.thumbnail ?? shop?.logo?.original ?? null

  return (
    <Link
      href={shopHomeHref(base)}
      className="flex min-w-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-shop-notch-ink/60"
    >
      {logo ? (
        <Image
          src={logo}
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0 rounded-md object-cover ring-1 ring-shop-notch-ink/25"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-md bg-shop-notch-ink text-xs font-bold text-shop-notch"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {/*
        The name is the first thing to go on a narrow screen. Three slabs share
        one 360px edge, and the shop's mark already answers "whose shop is this"
        — the words are what push the menu slab off centre.
      */}
      <span className="hidden truncate font-heading text-[0.9375rem] font-semibold tracking-tight text-shop-notch-ink sm:inline">
        {name}
      </span>
    </Link>
  )
}

/**
 * The action slab.
 *
 * Search and the wishlist only appear from `xl`, where the menu slab has spread
 * into pills and there is room for them. Below that they live in the dropdown
 * panel — which is also why they are not rendered twice: the panel is
 * `xl:hidden` and these are `xl`-and-up, so each control has exactly one place
 * in the DOM at any width.
 *
 * **The globe is gone from here.** Language moved into the two panels that
 * already open off this bar — the account menu and the notch drawer — because a
 * globe on the slab was a third route to the same two-item choice. The slab is
 * left to the controls that are about *this shop*: its catalogue, the saved
 * list, the account and the bag.
 *
 * The gap that leaves is a signed-out visitor at `xl`, who has neither panel —
 * the drawer is `xl:hidden` and their account slab is a link to the sign-in
 * screen, not a menu. That is a known and deliberate state, tracked in TODO.md;
 * do not re-add a control here without reading that entry first.
 */
function HeaderActions({ slug }: { slug: string }) {
  const t = useTranslations("shop")
  const tCatalog = useTranslations("catalog")
  const { base } = useShop()

  return (
    <div className="flex items-center gap-1">
      <div className="hidden xl:block">
        <HeaderSearch placeholder={tCatalog("searchPlaceholder")} />
      </div>

      <Button
        variant="ghost"
        size="icon"
        nativeButton={false}
        className={cn(NOTCH_GHOST, "hidden xl:inline-flex")}
        render={
          <Link
            href={`${base}/wishlist`}
            prefetch={false}
            aria-label={t("wishlist")}
          />
        }
      >
        <Heart />
      </Button>

      <AccountControl slug={slug} />
      <CartButton />
    </div>
  )
}

/**
 * The bag opens the cart rather than navigating. `/cart` is still a real,
 * linkable page — both surfaces' "View cart" goes there — but confirming an add
 * should not cost a page transition each way.
 *
 * *Which* surface it opens is `useCartDrawerStore`'s `surface`: the inset sheet
 * or the panel hanging off this button. The two are skins over one `open` flag,
 * so everything that opens the cart — a catalogue tile's quick add, the product
 * page's buy bar, this button — is written once and works on either.
 *
 * `data-cart-anchor` is how the flight layer finds this button. An attribute
 * rather than a ref because the code that needs the rectangle is a store action
 * called from a catalogue tile twelve components away, and it measures on every
 * add rather than caching: the bar is fixed and the page scrolls under it.
 */
function CartButton() {
  const surface = useCartDrawerStore((s) => s.surface)
  const openCart = useCartDrawerStore((s) => s.openDrawer)
  const open = useCartDrawerStore((s) => s.open)
  const setOpen = useCartDrawerStore((s) => s.setOpen)

  // The drawer is mounted by `ShopShell` and only *told* to open, so here the
  // bag is a plain button. The panel has no such home — it hangs off this
  // button — so on that surface the same bag becomes the trigger and the panel
  // rides along with it. Both read one `open`, which is what lets the add
  // gesture's delayed open work identically on either.
  if (surface === "drawer") return <BagButton onClick={openCart} />

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={(props) => <BagButton {...props} />} />
      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[min(23rem,calc(100vw-1.5rem))] gap-0 overflow-hidden rounded-2xl border border-shop-hairline bg-popover p-0 shadow-2xl"
      >
        <CartPanel />
      </PopoverContent>
    </Popover>
  )
}

/**
 * The bag itself — the slab's one filled control, on either surface.
 *
 * It takes its props through rather than owning its handler because on the
 * panel surface those props are the popover trigger's (the anchor ref, the
 * toggle, `aria-expanded`), and the flight layer's `data-cart-anchor` has to
 * stay on the element that is actually on the slab in both cases.
 */
function BagButton(props: React.ComponentProps<typeof Button>) {
  const tCart = useTranslations("cart")
  const locale = resolveLocale(useLocale())
  const { cart, itemCount } = useCart()
  const landings = useCartFlightStore((s) => s.landings)

  return (
    <Button
      {...props}
      size="icon"
      className="relative size-9 rounded-full bg-shop-accent text-shop-accent-foreground transition-colors hover:bg-shop-accent/90"
      data-cart-anchor
      aria-label={tCart("openCart")}
    >
      <ShoppingBag />

      {/*
        The pulse a landing photo sets off. Keyed on the landing count so two
        adds in a row play two pulses — remounting is the only way to restart a
        CSS animation, and it costs nothing on an empty element. It deliberately
        is not the badge: that one holds the rolling digits and has to survive
        the change it is animating.
      */}
      {landings > 0 && (
        <span
          key={landings}
          aria-hidden
          className="pointer-events-none absolute -inset-px animate-cart-land rounded-[inherit] ring-2 ring-shop-accent"
        />
      )}

      {/*
        Mounted as soon as the cart has been *read*, not when the count turns
        non-zero — and that distinction is the whole reason the digits roll at
        all. `NumberFlow` animates only on the branch that finds an existing
        instance; its first `data` is drawn straight
        (`number-flow/dist/lite.mjs`, the `created` check). Gating the span on
        `itemCount > 0` therefore made the one count change every shopper
        actually watches — 0 -> 1, the first add after a page load — a *mount*,
        which is a static paint. It only ever rolled from the second add
        onwards, which is why it read as "no animation".

        So the empty state is hidden with opacity and scale rather than by
        unmounting, and never with `hidden`/`display:none`/`w-0`: the roll is
        gated on `offsetWidth > 0 && offsetHeight > 0`, so anything that takes
        the badge out of layout disables it again, silently.
        `pointer-events-none` because the span overlays the bag button even
        while there is nothing to show.
      */}
      {cart && (
        // Decorative next to an already-labelled control — the authoritative
        // count is the heading on the cart page.
        <span
          aria-hidden
          data-shown={itemCount > 0 ? "" : undefined}
          className={cn(
            "pointer-events-none absolute -top-1.5 -end-1.5 grid min-w-[1.125rem] scale-75 place-items-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums opacity-0 ring-2 transition-[opacity,scale] duration-300 data-shown:scale-100 data-shown:opacity-100",
            "bg-shop-notch-ink text-shop-notch ring-shop-notch",
          )}
        >
          {/*
            Capped at 99 with a suffix rather than rendered as the string "99+":
            `NumberFlow` animates a number, and handing it text would drop back
            to a plain swap at exactly the point the cart is busiest.
          */}
          <NumberFlow
            value={Math.min(itemCount, 99)}
            suffix={itemCount > 99 ? "+" : ""}
            locales={locale}
            willChange
            transformTiming={COUNT_TIMING}
            opacityTiming={COUNT_TIMING}
          />
        </span>
      )}
    </Button>
  )
}

/**
 * The account control, in three states rather than two.
 *
 * The third one is what makes it correct. `hydrated` is false during SSR *and*
 * during the first client render, because the token cookie can only be read in
 * an effect — so both renders show the same neutral link and React has nothing
 * to reconcile. Deciding "signed out" from an unread store instead would flash
 * "Sign in" at someone who is already signed in, on every single page load.
 */
function AccountControl({ slug }: { slug: string }) {
  const t = useTranslations("shop")
  const tCommon = useTranslations("common")
  const tAccount = useTranslations("account")
  const { user, isAuthenticated, hydrated } = useCurrentUser()
  const { base } = useShop()
  const openAuth = useAuthDialogStore((s) => s.open)

  if (!hydrated) {
    return (
      <Button
        variant="ghost"
        size="icon"
        nativeButton={false}
        className={NOTCH_GHOST}
        render={
          <Link
            href={`${base}/account`}
            prefetch={false}
            aria-label={t("account")}
          />
        }
      >
        <User />
      </Button>
    )
  }

  if (!isAuthenticated) {
    // A popup rather than a link to `/login`: signing in from the header is an
    // interruption in the middle of shopping, and the route would throw away
    // the page — the catalogue scroll, the product being read — to show a form
    // with the same fields on it. The route still exists for the guard's own
    // redirects and for a link arriving from outside.
    return (
      <Button
        variant="ghost"
        size="icon"
        className={NOTCH_GHOST}
        aria-label={tCommon("signIn")}
        onClick={() => openAuth()}
      >
        <User />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon"
            className={NOTCH_GHOST}
            aria-label={
              user?.name
                ? tAccount("greeting", { name: user.name })
                : t("account")
            }
          >
            {/*
              The glyph, not the customer's face. The slab carries three other
              controls and the shop's own mark, and a photograph among them
              competes with the one image on the bar that identifies where you
              are. The face belongs to the menu, where it is the heading of the
              customer's own panel rather than a fourth thing on a shared strip.
            */}
            <User />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="min-w-56">
        {/*
          `DropdownMenuGroup` is not decoration. `DropdownMenuLabel` is base-ui's
          `Menu.GroupLabel`, which **throws** outside a `Menu.Group` — in
          production too, as a minified invariant. Radix's equivalent did not,
          so the shape shadcn generates against Radix is a crash here, and it is
          a crash nothing catches until a signed-in customer opens this menu:
          `next build` renders no menu panel, and the whole app's other menus
          already wrap correctly. The group is also what points the items'
          accessible name at the label above them.
        */}
        <DropdownMenuGroup>
          {/*
            The profile can still be in flight — it is a separate request from
            the token cookie that proved the session. Falling back to the generic
            label keeps the menu usable in that gap rather than rendering a
            half-empty greeting, and `UserAvatar` degrades to the same neutral
            glyph the slab is showing.
          */}
          <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
            <UserAvatar user={user} className="size-9" />
            <span className="flex min-w-0 flex-col">
              {/* The name when they gave one, else the number they sign in
                  with — the customer's identity either way. */}
              <span
                className="truncate text-sm font-medium"
                dir={user?.name ? undefined : "ltr"}
              >
                {user?.name ?? user?.phone_e164 ?? tAccount("title")}
              </span>
              {user?.name && user.phone_e164 && (
                <span
                  className="truncate text-xs text-muted-foreground"
                  dir="ltr"
                >
                  {user.phone_e164}
                </span>
              )}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={<Link href={`${base}/account`} prefetch={false} />}
          >
            <User />
            {tAccount("title")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`${base}/account/orders`} prefetch={false} />}
          >
            <Receipt />
            {tAccount("orders")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`${base}/account/addresses`} prefetch={false} />}
          >
            <MapPin />
            {tAccount("addresses")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`${base}/wishlist`} prefetch={false} />}
          >
            <Heart />
            {tAccount("wishlist")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {/*
          Language sits in the menu as a control, not as a row that opens a
          third surface. It is deliberately *not* a `DropdownMenuItem`: an item
          closes the menu on press, and the whole value of switching from in
          here is watching this panel change script under you.
        */}
        <div className="px-1.5 py-1.5">
          <p className="mb-1.5 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
            <Globe className="size-3.5" />
            {tCommon("language")}
          </p>
          <LocaleSegmented label={tCommon("language")} />
        </div>

        {MULTI_CURRENCY_ENABLED && (
          <div className="px-1.5 pb-1.5">
            <CurrencySwitcher variant="compact" />
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut(slug, base, tAccount("signedOut"))}
        >
          <LogOut />
          {tCommon("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The signed-in customer's face, on the slab and again at the head of the menu.
 *
 * The initials of the customer's name, or — for a customer who has not given
 * one, and while the profile is still in flight — the same neutral glyph the
 * signed-out control shows. Without that glyph the control would go blank for
 * the width of a request on every cold load, which reads as broken rather than
 * as loading. A shop's customer has no uploaded photo: it is not a platform
 * account.
 *
 * It wears the **notch** tokens in both of its homes, including inside the menu
 * panel, and that is a choice rather than an oversight: `--shop-notch-ink` and
 * `--popover-foreground` hold the same value in both themes, and the same object
 * in two places should not read as two objects. Retuning the notch ink alone is
 * the one edit that would make the menu copy worth revisiting.
 */
function UserAvatar({
  user,
  className,
}: {
  user: CurrentUser | null
  className?: string
}) {
  // No name yet — the same glyph the signed-out control shows, in a box the
  // size of the circle it stands in for, so the slab does not resize when the
  // profile lands. The colour is inherited (`NOTCH_GHOST` on the slab, the
  // popover's own ink in the menu) rather than named, because this one renders
  // in both.
  if (!user?.name) {
    return (
      <span className={cn("grid size-7 shrink-0 place-items-center", className)}>
        <User className="size-4" />
      </span>
    )
  }

  return (
    <Avatar
      className={cn(
        // `mix-blend-normal` overrides the primitive's darken/lighten blend: the
        // ring is drawn over the dark notch ink, not a flat muted ground, and a
        // blended hairline disappears into it.
 "size-7 after:border-shop-notch-ink/20 after:mix-blend-normal",
        className,
      )}
    >
      <AvatarFallback className="bg-shop-notch-ink text-[0.625rem] font-bold text-shop-notch">
        {initialsOf(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

/**
 * Up to two letters, from the first and last word of the name.
 *
 * Split on any whitespace rather than a single space so a name that arrived
 * with a stray double space or a non-breaking one does not produce an empty
 * second initial. `Array.from` rather than `[0]` because a code unit is not a
 * character — a name starting outside the BMP would otherwise yield half a
 * surrogate pair and render as a replacement glyph.
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  const first = Array.from(words[0]!)[0] ?? ""
  const last = words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? "") : ""
  return (first + last).toUpperCase()
}

/**
 * Sign out and land on the shop home.
 *
 * A full navigation rather than `router.push`, and for the same reason the
 * sign-*in* path takes one: the App Router caches route payloads that were
 * resolved under the old session, and only a document load is guaranteed to
 * discard them along with the Apollo cache that still holds this customer's
 * orders and addresses.
 */
async function signOut(slug: string, base: string, message: string) {
  // This shop only. The customer stays signed in at any other storefront
  // they have a session for — signing out of one shop is not signing out of
  // the platform.
  await clearAuthSession(slug)
  sileo.success({ title: message })
  window.location.href = shopHomeHref(base)
}

/**
 * What the action slab drops below `xl`, re-hung under the menu entries.
 *
 * The account links are not repeated here: the account icon stays on the slab
 * at every width and already owns that menu. This is only the controls that
 * would otherwise have nowhere to be on a phone.
 */
function PanelFooter({ slug }: { slug: string }) {
  const t = useTranslations("shop")
  const tCommon = useTranslations("common")
  const tAccount = useTranslations("account")
  const { isAuthenticated, hydrated } = useCurrentUser()
  const { base } = useShop()
  const openAuth = useAuthDialogStore((s) => s.open)

  return (
    <>
      <hr className="my-1 border-shop-notch-ink/10" />

      <Link
        href={`${base}/wishlist`}
        prefetch={false}
        className={PANEL_ROW}
      >
        <Heart className="size-4 shrink-0" />
        {t("wishlist")}
      </Link>

      {/*
        The same segmented control the account menu carries. It replaced a
        `labeled` `LocaleSwitcher` here, which was a dropdown opening out of a
        panel that is itself a dropdown — the shape this control exists to
        avoid, and the reason both places now look like one control.
      */}
      <div className="px-3 py-2">
        <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-shop-notch-muted">
          <Globe className="size-3.5" />
          {tCommon("language")}
        </p>
        <LocaleSegmented label={tCommon("language")} />
      </div>

      {MULTI_CURRENCY_ENABLED && (
        <div className="px-3 pb-2">
          <CurrencySwitcher variant="compact" />
        </div>
      )}

      {hydrated &&
        (isAuthenticated ? (
          <button
            type="button"
            onClick={() => void signOut(slug, base, tAccount("signedOut"))}
            className={cn(PANEL_ROW, "cursor-pointer text-destructive")}
          >
            <LogOut className="size-4 shrink-0" />
            {tCommon("signOut")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAuth()}
            className={cn(PANEL_ROW, "cursor-pointer")}
          >
            <User className="size-4 shrink-0" />
            {tCommon("signIn")}
          </button>
        ))}
    </>
  )
}

/**
 * Search box that navigates rather than filtering in place.
 *
 * It writes `?search=` on `/[shopSlug]/products` and lets the catalogue page own
 * the query, so a search is a URL a shopper can share, reload and go back from.
 * Seeded from the current `?search` so submitting from the results page shows
 * what is actually being searched instead of an empty field.
 */
function HeaderSearch({
  placeholder,
  className,
}: {
  placeholder: string
  className?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { base } = useShop()
  const [value, setValue] = useState(searchParams.get("search") ?? "")

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = value.trim()
        router.push(
          trimmed
            ? `${base}/products?search=${encodeURIComponent(trimmed)}`
            : `${base}/products`,
        )
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-shop-notch-muted start-3.5" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-full border-shop-notch-ink/15 bg-shop-notch-ink/[0.06] text-shop-notch-ink ps-10 placeholder:text-shop-notch-muted focus-visible:border-shop-notch-ink/35 focus-visible:ring-shop-notch-ink/20 xl:w-64"
      />
    </form>
  )
}
