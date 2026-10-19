"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { Link2, Loader2, Plus, Sparkles } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { MAP_INSTAGRAM_MEDIA_TO_PRODUCT } from "../api";
import type { MapInstagramMediaToProductResult } from "../types";

export function InstagramMediaMappingCard() {
  const t = useTranslations("settings.instagram.mediaMapping");

  const [mediaId, setMediaId] = useState("");
  const [productId, setProductId] = useState("");
  const [permalink, setPermalink] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [mapMedia, { loading: saving }] = useMutation<MapInstagramMediaToProductResult>(
    MAP_INSTAGRAM_MEDIA_TO_PRODUCT,
    {
      onCompleted() {
        setSavedSuccess(true);
        setMediaId("");
        setProductId("");
        setPermalink("");
        setTimeout(() => setSavedSuccess(false), 3000);
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaId.trim() || !productId.trim()) return;

    await mapMedia({
      variables: {
        input: {
          media_id: mediaId.trim(),
          product_id: productId.trim(),
        },
      },
    });
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 border-b pb-3">
        <Link2 className="h-5 w-5 text-primary" />
        <div>
          <h4 className="text-sm font-semibold">{t("title")}</h4>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("mediaId.label")}</Label>
          <Input
            placeholder={t("mediaId.placeholder")}
            value={mediaId}
            onChange={(e) => setMediaId(e.target.value)}
            required
            className="text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("productId.label")}</Label>
          <Input
            placeholder={t("productId.placeholder")}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            className="text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("permalink.label")}</Label>
          <Input
            placeholder={t("permalink.placeholder")}
            value={permalink}
            onChange={(e) => setPermalink(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="sm:col-span-3 flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              {t("saved")}
            </span>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="ltr:ml-auto rtl:mr-auto text-xs"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin ltr:mr-1 rtl:ml-1" />}
            <Plus className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
            {t("submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
