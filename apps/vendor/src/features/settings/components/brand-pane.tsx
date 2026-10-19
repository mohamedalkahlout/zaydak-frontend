"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { AlignLeftIcon, TypeIcon } from "lucide-react"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { MediaLibraryPicker } from "@/features/files/components/media-library-picker"
import { ACCEPTED_IMAGE_TYPES } from "@/shared/lib/upload/use-attachment-upload"
import { SettingsCard } from "./settings-card"
import { BrandGroup } from "./brand-row"
import { BrandChecklist } from "./brand-checklist"
import { BrandColorField } from "./brand-color-field"
import { BrandImageField } from "./brand-image-field"
import { BrandSocialLinks } from "./brand-social-links"
import { BrandTextField } from "./brand-text-field"
import {
  SHOP_SLOGAN_MAX,
  SHORT_DESCRIPTION_SOFT_MAX,
  fileToSettingsImage,
} from "../lib/brand"
import { BRAND_ANCHORS } from "../lib/brand-anchors"
import { useGeneralForm } from "./general-form-provider"
import type { SettingsImage } from "../types"

/**
 * The Brand sub-pane — Shopify's Settings > Brand, reached from the "Brand" row
 * in the General pane's Store assets card.
 *
 * Its own URL (`/settings/general/brand`), sharing the route group's form:
 * everything here stages, and the one contextual save bar in the navbar commits
 * it together with any address or contact edit still pending. That is what
 * keeps "unsaved changes" meaning one thing in this app.
 *
 * The screen is eight **slots**, not eight controls. Every asset — a logo, a
 * colour pair, a line of text, a social link — is one row that says what it is
 * for and carries a single plus, and only opens into an editor once it holds
 * something. Eight always-expanded controls is a screen a vendor scrolls past;
 * eight collapsed rows under a checklist is one they can finish.
 *
 * Four of the six groups are backed by columns that already existed — the
 * default logo, the cover image, the short description and the social links.
 * The square logo, the slogan and the colours live in `settings.brand`, which
 * is JSON, so they cost no migration.
 */
export function BrandPane() {
  const { form } = useGeneralForm()
  const t = useTranslations("settings.brand")
  const { register, watch, setValue } = form
  const v = watch()

  // The Logos card's footer opens the library for the default logo — a second
  // way into the picker the slot's own plus menu already offers. Local state,
  // like a text slot's reveal: opening the dialog is not an edit and must not
  // raise the save bar; only what it picks is staged.
  const [libraryOpen, setLibraryOpen] = useState(false)

  // Two narrow setters rather than one generic one: react-hook-form's `setValue`
  // resolves its value type from the literal path, and a `K extends keyof
  // GeneralValues` wrapper widens it to every field's type at once.
  const stageImage = (
    key: "logo" | "squareLogo" | "coverImage",
    next: SettingsImage | null,
  ) => setValue(key, next, { shouldDirty: true })

  const stageColor = (
    key:
      | "primaryBackground"
      | "primaryForeground"
      | "secondaryBackground"
      | "secondaryForeground",
    hex: string,
  ) => setValue(key, hex, { shouldDirty: true })

  return (
    <div className="flex flex-col gap-5">
      <BrandChecklist />

      {/* Logos ──────────────────────────────────────────────────────────── */}
      <SettingsCard
        id={BRAND_ANCHORS.logos}
        title={t("logos")}
        className="flex flex-col gap-5"
        footer={
          /*
            "No logo yet?" is only true while the default slot is empty, so the
            strip goes once it holds something. It opens the picker *in place*:
            the staged edit lives in the route group's layout, so a link that
            navigated this tab to the media library would unmount the form and
            discard whatever the vendor had not saved yet — which is why this
            used to be a link into a new tab. Link-styled, and `cursor-pointer`
            because Tailwind's preflight gives a `<button>` the arrow that an
            `<a>` never had.
          */
          v.logo ? undefined : (
            <p className="text-muted-foreground">
              {t("noLogoYet")}{" "}
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="cursor-pointer font-medium text-primary hover:underline"
              >
                {t("noLogoYetLink")}
              </button>
            </p>
          )
        }
      >
        <BrandGroup title={t("defaultGroup")} description={t("defaultGroupDesc")}>
          <BrandImageField
            shape="wide"
            label={t("defaultLogo")}
            addLabel={t("addDefaultLogo")}
            value={v.logo}
            onChange={(next) => stageImage("logo", next)}
          />
        </BrandGroup>
        <BrandGroup title={t("squareGroup")} description={t("squareGroupDesc")}>
          <BrandImageField
            shape="square"
            label={t("squareLogo")}
            addLabel={t("addSquareLogo")}
            value={v.squareLogo}
            onChange={(next) => stageImage("squareLogo", next)}
          />
        </BrandGroup>
      </SettingsCard>

      {/* The footer's picker. A dialog, so it renders nothing in the flow
          here; it sits beside the card it belongs to rather than inside a
          slot, because it fills the default logo whichever slot is empty.
          Same allow-list as the slots — SVG back in, which the picker's
          default filter drops for the AI models' sake, not a logo's. */}
      <MediaLibraryPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        accept={(mime) => ACCEPTED_IMAGE_TYPES.includes(mime)}
        onPick={(file) => stageImage("logo", fileToSettingsImage(file))}
      />

      {/* Colors ─────────────────────────────────────────────────────────── */}
      <SettingsCard
        id={BRAND_ANCHORS.colors}
        title={t("colors")}
        className="flex flex-col gap-5"
      >
        <BrandGroup title={t("primary")} description={t("primaryDesc")}>
          <BrandColorField
            title={t("primary")}
            addLabel={t("addPrimaryColor")}
            background={v.primaryBackground}
            foreground={v.primaryForeground}
            onBackgroundChange={(hex) => stageColor("primaryBackground", hex)}
            onForegroundChange={(hex) => stageColor("primaryForeground", hex)}
          />
        </BrandGroup>
        <BrandGroup title={t("secondary")} description={t("secondaryDesc")}>
          <BrandColorField
            title={t("secondary")}
            addLabel={t("addSecondaryColor")}
            background={v.secondaryBackground}
            foreground={v.secondaryForeground}
            onBackgroundChange={(hex) => stageColor("secondaryBackground", hex)}
            onForegroundChange={(hex) => stageColor("secondaryForeground", hex)}
          />
        </BrandGroup>
      </SettingsCard>

      {/* Cover image ────────────────────────────────────────────────────── */}
      <SettingsCard
        id={BRAND_ANCHORS.cover}
        title={t("coverImage")}
        description={t("coverImageDesc")}
      >
        <BrandImageField
          shape="cover"
          label={t("coverImage")}
          addLabel={t("addCoverImage")}
          value={v.coverImage}
          onChange={(next) => stageImage("coverImage", next)}
        />
      </SettingsCard>

      {/* Slogan ─────────────────────────────────────────────────────────── */}
      <SettingsCard
        id={BRAND_ANCHORS.slogan}
        title={t("slogan")}
        description={t("sloganDesc")}
      >
        <BrandTextField
          icon={TypeIcon}
          addLabel={t("addSlogan")}
          value={v.slogan}
          max={SHOP_SLOGAN_MAX}
        >
          <Input
            {...register("slogan")}
            maxLength={SHOP_SLOGAN_MAX}
            placeholder={t("sloganPlaceholder")}
          />
        </BrandTextField>
      </SettingsCard>

      {/* Short description ──────────────────────────────────────────────── */}
      <SettingsCard
        id={BRAND_ANCHORS.description}
        title={t("shortDescription")}
        description={t("shortDescriptionDesc")}
      >
        <BrandTextField
          icon={AlignLeftIcon}
          addLabel={t("addShortDescription")}
          value={v.description}
          softMax={SHORT_DESCRIPTION_SOFT_MAX}
        >
          <Textarea
            {...register("description")}
            rows={4}
            placeholder={t("shortDescriptionPlaceholder")}
          />
        </BrandTextField>
      </SettingsCard>

      {/* Social links ───────────────────────────────────────────────────── */}
      <SettingsCard
        id={BRAND_ANCHORS.socials}
        title={t("socialLinks")}
        description={t("socialLinksDesc")}
      >
        <BrandSocialLinks />
      </SettingsCard>

      <p className="pb-2 text-center text-sm text-muted-foreground">
        {t("learnMore")}
      </p>
    </div>
  )
}
