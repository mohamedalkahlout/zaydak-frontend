"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import type { AdPlatform } from "../types"
import { AD_PLATFORMS } from "../lib/routes"

export function CreateAdDialog({
  onCreate,
  trigger,
  defaultPlatform = "meta",
}: {
  onCreate: (input: { name: string; platform: AdPlatform }) => void
  trigger?: React.ReactElement
  defaultPlatform?: AdPlatform
}) {
  const t = useTranslations("ads")
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [platform, setPlatform] = useState<AdPlatform>(defaultPlatform)

  const reset = () => {
    setName("")
    setPlatform(defaultPlatform)
  }

  const submit = () => {
    onCreate({ name: name.trim() || t("create.untitled"), platform })
    reset()
    setOpen(false)
  }

  const defaultTrigger = (
    <Button className="h-9 gap-1.5 rounded-lg">
      <PlusIcon className="size-4" />
      {t("createAd")}
    </Button>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={trigger ?? defaultTrigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ads-campaign-name">{t("create.name")}</Label>
            <Input
              id="ads-campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("create.namePlaceholder")}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("create.platform")}</Label>
            <Select
              value={platform}
              onValueChange={(v) => {
                if (v) setPlatform(v as AdPlatform)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AD_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`platforms.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("create.cancel")}
          </Button>
          <Button type="button" onClick={submit}>
            {t("create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
