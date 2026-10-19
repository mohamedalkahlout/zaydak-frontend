"use client"

import { useState, type KeyboardEvent } from "react"
import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"
import { XIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Input } from "@repo/ui/components/input"
import { cn } from "@/shared/lib/utils"
import type { CustomerFormApi } from "../customer-form-layout"

/**
 * The Latin comma and the Arabic one (U+060C), which is what the comma key
 * types on an Arabic keyboard — the hint tells an Arabic merchant to press it.
 */
const TAG_SEPARATORS = /[,،]/
const isSeparatorKey = (key: string) => key === "," || key === "،"

/**
 * Sidebar Tags card — adds chips on Enter or comma, removes on click.
 * Matches Shopify's tag widget where each chip is a separate keyword used
 * to build customer segments.
 */
export function TagsCard({ form }: { form: CustomerFormApi }) {
  const t = useTranslations("customers.tagsCard")
  const [draft, setDraft] = useState("")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Controller
          control={form.control}
          name="tags"
          render={({ field }) => {
            const tags: string[] = Array.isArray(field.value)
              ? (field.value as string[])
              : []

            const commit = () => {
              const next = draft
                .split(TAG_SEPARATORS)
                .map((tag) => tag.trim())
                .filter(Boolean)
                .filter((tag) => !tags.includes(tag))
              if (next.length === 0) {
                setDraft("")
                return
              }
              field.onChange([...tags, ...next])
              setDraft("")
            }

            const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter" || isSeparatorKey(e.key)) {
                e.preventDefault()
                commit()
              } else if (e.key === "Backspace" && draft === "" && tags.length) {
                field.onChange(tags.slice(0, -1))
              }
            }

            return (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background p-2 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
                )}
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        field.onChange(tags.filter((other) => other !== tag))
                      }
                      className="grid place-content-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                      aria-label={t("remove", { tag })}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  onBlur={commit}
                  placeholder={tags.length === 0 ? t("placeholder") : ""}
                  className="h-7 min-w-32 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
                  aria-label={t("add")}
                />
              </div>
            )
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">{t("hint")}</p>
      </CardContent>
    </Card>
  )
}
