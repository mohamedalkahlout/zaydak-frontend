"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useSpring, type Variants } from "motion/react";
import {
  ArmchairIcon,
  ArrowUpIcon,
  GlobeIcon,
  MousePointer2Icon,
  PlusIcon,
  ShirtIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import Image from "@/shared/components/app-image";
import { useAiChatStore } from "@/features/ai/store-chat";
// Deep path on purpose: the feature's barrel also re-exports the list and
// the whole product form, and this app sets no `sideEffects` flag, so the
// barrel would pull both into the home bundle for one dialog.
import { CreateProductDialog } from "@/features/products/components/list/create-product-dialog";
import { cn } from "@/shared/lib/utils";
import { AiChatInput } from "@repo/ui/components/ai-chat-input";

// Shared easing — a soft "ease-out-expo" for entrances, a snappy spring for
// hover micro-interactions.
const EASE = [0.22, 1, 0.36, 1] as const;
const HOVER_SPRING = { type: "spring", stiffness: 320, damping: 22 } as const;

// Card surface reacts on hover; its label ("rest" / "hover") propagates to the
// illustration's motion children so the whole tile animates as one.
const CARD_HOVER: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4 },
};

// Illustration "pops" forward in 3D space — further on hover — for parallax
// depth as the card tilts under the pointer.
const ILLUS_DEPTH: Variants = {
  rest: { z: 24 },
  hover: { z: 64 },
};

// Pointer-driven 3D tilt: springy rotateX/rotateY motion values plus the
// handlers to wire onto a card. Resets to flat when the pointer leaves.
function useCardTilt(max: number) {
  const config = { stiffness: 150, damping: 15, mass: 0.3 };
  const rotateX = useSpring(0, config);
  const rotateY = useSpring(0, config);
  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rotateY.set(px * max);
    rotateX.set(-py * max);
  }
  function onMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }
  return { rotateX, rotateY, onMouseMove, onMouseLeave };
}

export function DashboardHome() {
  const t = useTranslations("home");
  const params = useParams<{ shopSlug: string }>();
  const base = `/store/${params?.shopSlug}`;
  // The product tile opens the kind picker rather than going anywhere, so it
  // drives the dialog directly. A link straight to `/products/new` skipped the
  // picker and landed every new merchant on the bare simple-product form.
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Promo banner — pinned to the trailing edge, à la the reference. */}
      <motion.div
        className="flex justify-end"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <PromoBanner />
      </motion.div>

      {/* Hero */}
      <motion.section
        className="flex flex-col items-center px-4 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-muted-foreground sm:text-[2.5rem] sm:leading-tight">
          {t("welcomeTitle")}
        </h1>
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-[2.5rem] sm:leading-tight">
          {t("welcomeSubtitle")}
        </h2>
        <AskBar />
      </motion.section>

      {/* Setup cards — 2 featured, then 3, then 1 centered. */}
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <OnboardCard
            taskKey="addProduct"
            onActivate={() => setPickerOpen(true)}
            illustration={<ProductIllustration />}
            delay={0.06}
            tall
            clip
          />

          <OnboardCard
            taskKey="payments"
            href={`${base}/settings/payments`}
            illustration={<PaymentsIllustration />}
            delay={0.18}
            tall
            clip
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Themes, not the editor behind it: the tile's CTA is "Choose
              theme", and /online-store/themes is the screen that names the
              current one and hands off to the editor. It used to point at
              brand settings because there was no theme editor to point at. */}
          <OnboardCard
            taskKey="storeDesign"
            href={`${base}/online-store/themes`}
            illustration={<ThemeIllustration />}
            delay={0.12}
            tall
          />
          <OnboardCard
            taskKey="nameStore"
            href={`${base}/settings/general`}
            illustration={<NameIllustration />}
            delay={0.24}
          />
          <OnboardCard
            taskKey="customDomain"
            href={`${base}/settings/domains`}
            hasBadge
            illustration={<DomainIllustration />}
            delay={0.3}
          />
        </div>

        <CreateProductDialog open={pickerOpen} onOpenChange={setPickerOpen} />
      </section>
    </div>
  );
}

function PromoBanner() {
  const t = useTranslations("home");
  return (
    <div className="flex items-center gap-3 rounded-full bg-zinc-900 py-1.5 pe-1.5 ps-4 text-sm text-white shadow-sm">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span className="hidden font-medium text-zinc-200 sm:inline">
        {t("promoText")}
      </span>
      <Button
        size="sm"
        className="rounded-full bg-white text-zinc-900 transition-transform hover:bg-zinc-100 active:scale-95"
      >
        {t("selectPlan")}
      </Button>
    </div>
  );
}

function AskBar() {
  const t = useTranslations("home");
  const openWithPrompt = useAiChatStore((s) => s.openWithPrompt);
  const openPanel = useAiChatStore((s) => s.openPanel);
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) {
      openPanel();
      return;
    }
    openWithPrompt(trimmed);
    setValue("");
  }

  return (
    <motion.div
      className="mt-7 flex w-full max-w-xl items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)] transition-colors focus-within:border-foreground/30 focus-within:ring-4 focus-within:ring-foreground/5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
      whileHover={{ scale: 1.01 }}
    >
      <motion.span
        className="grid size-7 shrink-0 place-items-center rounded-full bg-linear-to-br from-violet-500 via-fuchsia-500 to-sky-500 text-white"
        animate={{ scale: [1, 1.08, 1], rotate: [0, 6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <SparklesIcon className="size-3.5" />
      </motion.span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t("askPlaceholder")}
        aria-label={t("askPlaceholder")}
        className="min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 rounded-full text-muted-foreground"
        aria-label={t("attach")}
        disabled
      >
        <PlusIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 rounded-full bg-muted text-foreground transition-transform hover:bg-accent active:scale-90"
        onClick={submit}
        aria-label={t("send")}
      >
        <ArrowUpIcon className="size-4" />
      </Button>
    </motion.div>
  );
}

/**
 * The tile IS the button.
 *
 * Each card used to end in its own CTA — a row of outline buttons repeating
 * what the heading above them already said, and four of the five were inert.
 * The control now stretches over the whole card instead: the title carries the
 * real `<a>`/`<button>` and `after:absolute after:inset-0` blows its hit area
 * up to the card's bounds. That keeps one tab stop and one accessible name per
 * tile (the title, which already names the task) rather than adding a second
 * that reads "Add product" with no context, and it is why the focus ring is
 * drawn on the pseudo-element: the thing being focused is the card.
 *
 * The surface is `relative`, which is what the stretch resolves against.
 */
const TILE_ACTION = cn(
  "rounded-sm after:absolute after:inset-0 after:z-10 after:rounded-xl after:content-['']",
  "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2",
);

function OnboardCard({
  taskKey,
  illustration,
  href,
  onActivate,
  hasBadge,
  tall,
  clip,
  delay = 0,
}: {
  /** Maps to the `home.tasks.<key>` translation group. */
  taskKey: string;
  illustration: React.ReactNode;
  /** Where the whole tile goes. Mutually exclusive with `onActivate`. */
  href?: string;
  /** For a tile whose action is a dialog rather than a route. */
  onActivate?: () => void;
  hasBadge?: boolean;
  tall?: boolean;
  /** Clip the illustration to the card edges (for art that bleeds off). */
  clip?: boolean;
  delay?: number;
}) {
  const t = useTranslations("home");
  const { rotateX, rotateY, onMouseMove, onMouseLeave } = useCardTilt(
    clip ? 8 : 12,
  );

  const inner = (
    <>
      {hasBadge ? (
        <span className="mb-1 text-xs font-medium text-muted-foreground">
          {t(`tasks.${taskKey}.badge`)}
        </span>
      ) : null}
      <h3 className="font-heading text-lg font-semibold text-foreground">
        {href ? (
          <Link href={href} className={TILE_ACTION}>
            {t(`tasks.${taskKey}.title`)}
          </Link>
        ) : onActivate ? (
          <button
            type="button"
            onClick={onActivate}
            className={cn(TILE_ACTION, "text-start")}
          >
            {t(`tasks.${taskKey}.title`)}
          </button>
        ) : (
          t(`tasks.${taskKey}.title`)
        )}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {t(`tasks.${taskKey}.desc`)}
      </p>

      {/*
        `pointer-events-none` on the art, not just on the tiles that bleed:
        the un-clipped cards push their illustration forward in Z, and a
        3D-translated child paints above the title link's stretched
        pseudo-element whatever the z-index says — so a click landing on the
        t-shirt would hit a decorative div and go nowhere. Nothing in any
        illustration is interactive, so all of it falls through to the tile.
      */}
      {clip ? (
        // Clipped cards keep a flat stacking context so the bleed-off art
        // stays cropped to the rounded edge (3D would break overflow).
        <div
          className={cn(
            "pointer-events-none my-5 flex flex-1 items-center justify-center",
            tall ? "min-h-44" : "min-h-36",
          )}
        >
          {illustration}
        </div>
      ) : (
        <motion.div
          variants={ILLUS_DEPTH}
          transition={HOVER_SPRING}
          style={{ transformStyle: "preserve-3d" }}
          className={cn(
            "pointer-events-none my-5 flex flex-1 items-center justify-center",
            tall ? "min-h-44" : "min-h-36",
          )}
        >
          {illustration}
        </motion.div>
      )}
    </>
  );

  return (
    // Outer wrapper: cinematic staggered entrance + 3D perspective for the tilt.
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.95, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      style={{ perspective: 1000 }}
      className="min-w-0"
    >
      {/* Inner surface: pointer-driven 3D tilt + hover lift; drives the
          illustration variants (incl. its parallax depth). */}
      <motion.div
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        initial="rest"
        animate="rest"
        whileHover="hover"
        variants={CARD_HOVER}
        transition={HOVER_SPRING}
        style={{
          rotateX,
          rotateY,
          transformStyle: clip ? undefined : "preserve-3d",
        }}
        className={cn(
          (href ?? onActivate) && "cursor-pointer",
          "relative flex h-full min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:border-foreground/15 hover:shadow-[0_22px_50px_-20px_rgba(0,0,0,0.32)]",
          clip && "overflow-hidden",
        )}
      >
        {inner}
      </motion.div>
    </motion.div>
  );
}

/* ── Illustrations ───────────────────────────────────────────────────────
   The reference uses marketing photos we don't ship as assets, so each tile
   is recreated with CSS + icons. Motion children declare `rest`/`hover`
   variants and inherit the card's hover state for coordinated motion. */

function ProductIllustration() {
  const left: Variants = {
    rest: { rotate: -3, x: 0, y: 0 },
    hover: { rotate: -9, x: -6, y: -4 },
  };
  const mid: Variants = {
    rest: { rotate: 0, scale: 1 },
    hover: { rotate: 90, scale: 1.05 },
  };
  const right: Variants = {
    rest: { rotate: 3, x: 0, y: 0 },
    hover: { rotate: 9, x: 6, y: -4 },
  };
  const tile =
    "flex size-16 shrink-0 items-center justify-center rounded-2xl sm:size-20 lg:size-24";
  return (
    <div className="flex w-full max-w-full items-center justify-center gap-2 overflow-hidden sm:gap-3">
      <motion.div
        variants={left}
        transition={HOVER_SPRING}
        className={cn(
          tile,
          "bg-linear-to-br from-stone-100 to-stone-200 shadow-sm ring-1 ring-black/5",
        )}
      >
        <ShirtIcon className="size-7 text-stone-500 sm:size-8 lg:size-10" strokeWidth={1.25} />
      </motion.div>
      <motion.div
        variants={mid}
        transition={HOVER_SPRING}
        className={cn(
          tile,
          "border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-400",
        )}
      >
        <PlusIcon className="size-6 sm:size-7 lg:size-8" />
      </motion.div>
      <motion.div
        variants={right}
        transition={HOVER_SPRING}
        className={cn(
          tile,
          "bg-linear-to-br from-emerald-100 to-teal-200 shadow-sm ring-1 ring-black/5",
        )}
      >
        <ArmchairIcon
          className="size-7 text-emerald-700/70 sm:size-8 lg:size-10"
          strokeWidth={1.25}
        />
      </motion.div>
    </div>
  );
}

function ThemeIllustration() {
  const leftCard: Variants = {
    rest: { rotate: -6, x: 0 },
    hover: { rotate: -13, x: -12 },
  };
  const rightCard: Variants = {
    rest: { rotate: 6, x: 0 },
    hover: { rotate: 13, x: 12 },
  };
  const centerCard: Variants = {
    rest: { y: 0, scale: 1 },
    hover: { y: -8, scale: 1.05 },
  };
  return (
    <div className="relative h-36 w-full max-w-xs">
      <motion.div
        variants={leftCard}
        transition={HOVER_SPRING}
        className="absolute left-6 top-4 h-28 w-24 rounded-xl bg-linear-to-br from-sky-200 to-indigo-200 shadow-md ring-1 ring-black/5"
      />
      <motion.div
        variants={rightCard}
        transition={HOVER_SPRING}
        className="absolute right-6 top-4 flex h-28 w-24 items-center justify-center rounded-xl bg-linear-to-br from-orange-300 to-rose-300 shadow-md ring-1 ring-black/5"
      >
        <span className="font-heading text-2xl font-black text-white/90">
          CH
        </span>
      </motion.div>
      <motion.div
        variants={centerCard}
        transition={HOVER_SPRING}
        className="absolute left-1/2 top-1 flex h-32 w-28 -translate-x-1/2 flex-col items-center justify-center gap-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/10"
      >
        <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <span className="text-lg font-bold">Aa</span>
        </div>
        <div className="h-1.5 w-12 rounded-full bg-zinc-200" />
        <div className="h-1.5 w-9 rounded-full bg-zinc-200" />
      </motion.div>
    </div>
  );
}

// Layered, directional shadow that makes each card read as a physical,
// floating object rather than a flat rectangle.
const CARD_SHADOW =
  "shadow-[0_2px_4px_rgba(0,0,0,0.08),0_10px_20px_-6px_rgba(0,0,0,0.18),0_26px_50px_-18px_rgba(0,0,0,0.28)]";

// Matches Shopify's mini-payment motion: a slight overshoot on rotate, a
// smooth glide on translate.
const PAY_TRANSITION = {
  rotate: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] as const },
  default: { duration: 0.5, ease: [0.25, 1, 0.5, 1] as const },
};

// Shared base for every mini payment card (Shopify `._MiniPayment`): fixed
// 10rem width, card aspect, 20px radius (radius-500), clipped, soft shadow.
const MINI_CARD = cn(
  "absolute flex w-[10rem] aspect-[8/5] items-center justify-center overflow-hidden rounded-[1.25rem] ring-1",
  CARD_SHADOW,
);

// The three brand marks are the real payment badges (`public/payment-*.svg`),
// not hand-drawn approximations: each file already IS a card — a rounded,
// brand-filled rectangle at roughly the 8:5 aspect the mini cards use — so it
// fills its card edge to edge rather than sitting as a logo on a fake ground.
// `unoptimized` because these are local vectors: `/_next/image` has nothing to
// gain on an SVG, matching how `app-logo` serves ours.
const PAY_BRANDS = {
  mastercard: { src: "/payment-mastercard.svg", fallback: "bg-[#1C1C1C]" },
  paypal: { src: "/payment-paypal.svg", fallback: "bg-white" },
  visa: { src: "/payment-visa.svg", fallback: "bg-[#142FBD]" },
} as const;

// Decorative: the tile's own heading already says "Set up payments", so the
// badges are announced to nobody.
function PayBrand({ brand }: { brand: keyof typeof PAY_BRANDS }) {
  return (
    <Image
      src={PAY_BRANDS[brand].src}
      alt=""
      fill
      sizes="160px"
      unoptimized
      className="object-cover"
    />
  );
}

function PaymentsIllustration() {
  // The fan is laid out to sit WHOLE inside the (clipped) tile rather than
  // bleeding off its trailing corner: every card is drawn at full scale and
  // stepped across the tile's right half, and each hover offset is bounded so
  // the spread cannot push a card back past an edge. A rotated card's box is
  // wider than the card — a 160x100 rect at 17 degrees spans ~178x133 — so the
  // `end`/`bottom` values below already carry ~20px of slack for the corners
  // the rotation throws out. VISA is still the front "hero".
  const paypal: Variants = {
    rest: { scale: 1, x: 0, y: 0, rotate: -8 },
    hover: { scale: 1, x: -14, y: -12, rotate: -12 },
  };
  const visa: Variants = {
    rest: { scale: 1, x: 0, y: 0, rotate: -13 },
    hover: { scale: 1, x: -2, y: 8, rotate: -17 },
  };
  const mastercard: Variants = {
    rest: { scale: 1, x: 0, y: 0, rotate: 12 },
    hover: { scale: 1, x: 10, y: -8, rotate: 16 },
  };
  return (
    // -inset-5 cancels the card's p-5 so this layer spans the card's full
    // border box; cards positioned to it bleed off the rounded edge.
    <div className="pointer-events-none absolute -inset-5">
      {/* Mastercard — back of the fan, nearest the trailing edge */}
      <motion.div
        variants={mastercard}
        transition={PAY_TRANSITION}
        className={cn(
          MINI_CARD,
          PAY_BRANDS.mastercard.fallback,
          "bottom-[6rem] end-[1.75rem] z-[1] ring-white/10",
        )}
      >
        <PayBrand brand="mastercard" />
        {/* Sheen sits above the badge so the card still reads as glass. */}
        <span className="absolute inset-0 bg-linear-to-tr from-white/0 via-white/5 to-white/15" />
      </motion.div>

      {/* PayPal — highest and furthest from the edge, behind */}
      <motion.div
        variants={paypal}
        transition={PAY_TRANSITION}
        className={cn(
          MINI_CARD,
          PAY_BRANDS.paypal.fallback,
          "bottom-[6.25rem] end-[10rem] z-0 ring-black/5",
        )}
      >
        <PayBrand brand="paypal" />
      </motion.div>

      {/* VISA — front hero card */}
      <motion.div
        variants={visa}
        transition={PAY_TRANSITION}
        className={cn(
          MINI_CARD,
          PAY_BRANDS.visa.fallback,
          "bottom-[2.5rem] end-[5.5rem] z-[2] ring-white/10",
        )}
      >
        <PayBrand brand="visa" />
        <span className="absolute inset-0 bg-linear-to-tr from-white/0 via-white/10 to-white/30" />
        <span className="absolute -start-6 -top-6 size-16 rounded-full bg-white/10 blur-md" />
      </motion.div>
    </div>
  );
}

function NameIllustration() {
  const sticker: Variants = {
    rest: { rotate: -2, scale: 1 },
    hover: { rotate: 2, scale: 1.05 },
  };
  return (
    <motion.div variants={sticker} transition={HOVER_SPRING}>
      {/*
        The sticker is a die-cut PNG on a transparent ground, so it carries no
        card chrome of its own: a `bg`/`ring`/`shadow-md` here would draw the
        rectangle the artwork deliberately isn't. `drop-shadow` follows the
        alpha instead, so the shadow traces the sticker's rounded outline.
        Left optimizable (unlike the vector payment badges) — it is a real
        raster, and `/_next/image` serves it as a right-sized WebP/AVIF.
        Decorative: the tile's own heading names the task.
      */}
      <Image
        src="/name-tag-sticker.png"
        alt=""
        width={400}
        height={312}
        className="h-auto w-48 drop-shadow-[0_6px_10px_rgba(0,0,0,0.22)]"
      />
    </motion.div>
  );
}

function DomainIllustration() {
  const bar: Variants = {
    rest: { scale: 1 },
    hover: { scale: 1.04 },
  };
  const cursor: Variants = {
    rest: { x: 0, y: 0 },
    hover: { x: -5, y: -5 },
  };
  return (
    <div className="relative w-44">
      <div
        className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
        style={{
          backgroundImage:
            "linear-gradient(#eef2f6 1px, transparent 1px), linear-gradient(90deg, #eef2f6 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        <motion.div
          variants={bar}
          transition={HOVER_SPRING}
          className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 shadow ring-1 ring-black/5"
        >
          <GlobeIcon className="size-3.5 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium text-zinc-700">
            .yourstore.com
          </span>
        </motion.div>
      </div>
      <motion.div
        variants={cursor}
        transition={HOVER_SPRING}
        className="absolute -bottom-2 end-3"
      >
        <MousePointer2Icon className="size-5 text-zinc-800 drop-shadow" />
      </motion.div>
    </div>
  );
}
