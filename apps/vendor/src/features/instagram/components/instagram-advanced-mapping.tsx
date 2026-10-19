"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  Code2,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";

interface InstagramAdvancedMappingProps {
  onManualMap: (data: {
    mediaId: string;
    productId: string;
    permalink?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function InstagramAdvancedMapping({
  onManualMap,
  loading = false,
}: InstagramAdvancedMappingProps) {
  const t = useTranslations("settings.instagram.advanced");
  const [open, setOpen] = useState(false);
  const [mediaId, setMediaId] = useState("");
  const [productId, setProductId] = useState("");
  const [permalink, setPermalink] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaId.trim() || !productId.trim()) return;

    await onManualMap({
      mediaId: mediaId.trim(),
      productId: productId.trim(),
      permalink: permalink.trim() || undefined,
    });

    setSuccess(true);
    setMediaId("");
    setProductId("");
    setPermalink("");
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-2xl border bg-muted/20 overflow-hidden transition-all"
    >
      <CollapsibleTrigger
        type="button"
        className="w-full flex items-center justify-between p-4 sm:p-5 text-start hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted text-muted-foreground">
            <Code2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              {t("title")}
            </h4>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="p-5 pt-0 border-t bg-card/60">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div className="space-y-1">
            <Label className="text-xs">{t("mediaIdLabel")}</Label>
            <Input
              placeholder={t("mediaIdPlaceholder")}
              value={mediaId}
              onChange={(e) => setMediaId(e.target.value)}
              required
              className="text-xs font-mono h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t("productIdLabel")}</Label>
            <Input
              placeholder={t("productIdPlaceholder")}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="text-xs font-mono h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t("permalinkLabel")}</Label>
            <Input
              placeholder={t("permalinkPlaceholder")}
              value={permalink}
              onChange={(e) => setPermalink(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="sm:col-span-3 flex items-center justify-between pt-2">
            {success && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                {t("saved")}
              </span>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="ltr:ml-auto rtl:mr-auto text-xs h-9"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin ltr:mr-1 rtl:ml-1" />}
              <Plus className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
              {t("submit")}
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
