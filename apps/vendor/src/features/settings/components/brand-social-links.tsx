"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDownIcon, XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { useGeneralForm } from "./general-form-provider"
import {
  SOCIAL_NETWORKS,
  SOCIAL_SPECS,
  isLikelyUrl,
  type SocialNetwork,
} from "../lib/socials"

/**
 * The social links slot: one row per network the shop actually uses, and a
 * picker for the rest.
 *
 * The nine networks used to be nine permanent inputs, which is nine rows of
 * empty field for a shop with an Instagram and nothing else. Rendering only
 * what is set — plus whatever the vendor just picked — is what makes this card
 * the same size as its neighbours.
 *
 * A row is shown when it holds a value **or** when it was picked from the menu.
 * Both halves matter: without the first, a discarded edit would restore a link
 * with no row to show it in; without the second, clearing the text to retype it
 * would delete the row out from under the cursor.
 */
export function BrandSocialLinks() {
  const t = useTranslations("settings.brand")
  const { form } = useGeneralForm()
  const { register, watch, setValue } = form
  const socials = watch("socials")

  const [picked, setPicked] = useState<SocialNetwork[]>([])

  const shown = SOCIAL_NETWORKS.filter(
    (network) => picked.includes(network) || (socials[network] ?? "").trim(),
  )
  const remaining = SOCIAL_NETWORKS.filter((network) => !shown.includes(network))

  const remove = (network: SocialNetwork) => {
    setValue(`socials.${network}`, "", { shouldDirty: true })
    setPicked((current) => current.filter((n) => n !== network))
  }

  return (
    <div className="flex flex-col gap-3">
      {shown.map((network) => {
        const spec = SOCIAL_SPECS[network]
        const Icon = spec.icon
        const value = socials[network] ?? ""
        const invalid = !isLikelyUrl(value)
        return (
          <div key={network} className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon aria-hidden className="size-4" />
              </span>
              <Input
                {...register(`socials.${network}`)}
                dir="ltr"
                spellCheck={false}
                aria-label={spec.label}
                aria-invalid={invalid || undefined}
                placeholder={spec.placeholder}
                className={cn(
                  "text-sm",
                  invalid &&
                    "border-destructive focus-visible:border-destructive",
                )}
              />
              <button
                type="button"
                aria-label={t("removeLink", { network: spec.label })}
                onClick={() => remove(network)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            {invalid && (
              <p className="ps-12 text-xs text-destructive">{t("invalidUrl")}</p>
            )}
          </div>
        )
      })}

      {remaining.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button
                {...props}
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
              >
                {t("addSocialLink")}
                <ChevronDownIcon className="size-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="start" className="w-52">
            {remaining.map((network) => {
              const spec = SOCIAL_SPECS[network]
              const Icon = spec.icon
              return (
                <DropdownMenuItem
                  key={network}
                  onClick={() => setPicked((current) => [...current, network])}
                >
                  <Icon aria-hidden className="size-4" />
                  {spec.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
