"use client"

import { useTranslations } from "next-intl"

import { CloudShader } from "@repo/ui/components/cloud-shader"

import Image from "@/shared/components/app-image"

import { HeroSocialProof } from "./hero-social-proof"

/**
 * Aceternity cloud-shader sky palette — literal hexes, not `--shop-*` tokens.
 * `CloudShader` only parses `#hex` / `rgb()`; a token or `oklch()` falls through
 * to grey. These are the demo's own colours and stay that way on purpose.
 */
const SKY = {
  cloud: "#fbf8f2",
  top: "#3876ba",
  bottom: "#8cbfe8",
} as const

/** Zaydak marketplace showcase frame. */
const HERO_SHOT = "/zaydak-marketplace-preview.jpg"

/**
 * The marketplace front door's opening band: drifting blue sky, white type,
 * pill CTAs, social-proof badge fan, and a frosted glass product frame — the
 * Aceternity hero composition with Zaydak copy and real `#shops` destinations.
 *
 * It belongs to `/`, not to a storefront. The demo's own navbar is gone: the
 * page's notch bar (`DirectoryHeader`) already sits fixed over this sky. The
 * section starts at the top of the document; `pt-28` keeps the headline clear
 * of the slabs.
 */
export function CloudShaderHeroDemo() {
  const t = useTranslations("landing")

  return (
    <div className="relative min-h-[50rem] w-full overflow-hidden">
      <CloudShader
        className="absolute inset-0"
        cloudColor={SKY.cloud}
        skyTopColor={SKY.top}
        skyBottomColor={SKY.bottom}
      />

      {/* hero — nav → social proof → H1 → lede → CTAs → glass frame */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 pt-28 text-center md:pt-36">
        <HeroSocialProof />

        <h1 className="mt-10 text-4xl font-bold tracking-tight text-white drop-shadow-md md:mt-12 md:text-6xl lg:text-7xl">
          {t.rich("heroTitle", {
            br: () => <br className="hidden md:block" />,
          })}
        </h1>
        <p className="mt-6 max-w-2xl text-base text-white/90 drop-shadow-sm md:text-lg">
          {t("heroLede")}
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="#shops"
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-sky-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-white/90"
          >
            {t("heroBrowse")}
          </a>
          <a
            href="#shops"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            {t("heroSecondary")}
          </a>
        </div>
        <p className="mt-4 text-xs text-white/70">{t("heroNote")}</p>
      </div>

      {/* dashboard image */}
      <div className="relative z-10 mx-auto mt-10 w-full max-w-6xl px-4 pb-4 md:mt-14 md:px-8">
        <div className="rounded-2xl border border-white/30 bg-white/20 p-2 shadow-2xl backdrop-blur-md md:rounded-[2rem] md:p-3">
          <Image
            src={HERO_SHOT}
            alt={t("heroShotAlt")}
            width={1600}
            height={1000}
            priority
            className="h-auto w-full rounded-xl border border-black/5 shadow-lg md:rounded-3xl"
          />
        </div>
      </div>
    </div>
  )
}
