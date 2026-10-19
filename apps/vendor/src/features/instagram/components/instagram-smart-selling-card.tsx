"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, MessageSquare, Plus, ShoppingBag, Sparkles } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import type {
  InstagramCommentReplyMode,
  ShopInstagramAccount,
} from "../types";

const COMMENT_REPLY_MODES: InstagramCommentReplyMode[] = [
  "PRIVATE",
  "PUBLIC",
  "PUBLIC_AND_PRIVATE",
  "DISABLED",
];

interface InstagramSmartSellingCardProps {
  account: ShopInstagramAccount | null;
  onUpdateAiEnabled: (enabled: boolean) => Promise<void>;
  onUpdateOrdersEnabled: (enabled: boolean) => Promise<void>;
  onUpdateCommentsEnabled: (enabled: boolean) => Promise<void>;
  onUpdateKeywords: (keywords: string[]) => Promise<void>;
  onUpdateCommentReplyMode: (mode: InstagramCommentReplyMode) => Promise<void>;
  disabled?: boolean;
}

export function InstagramSmartSellingCard({
  account,
  onUpdateAiEnabled,
  onUpdateOrdersEnabled,
  onUpdateCommentsEnabled,
  onUpdateKeywords,
  onUpdateCommentReplyMode,
  disabled = false,
}: InstagramSmartSellingCardProps) {
  const t = useTranslations("settings.instagram");
  const [newKeyword, setNewKeyword] = useState("");

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKeyword.trim();
    if (!trimmed) return;

    const current = account?.comment_keywords ?? ["السعر", "تفاصيل", "متوفر", "طلب"];
    if (!current.includes(trimmed)) {
      await onUpdateKeywords([...current, trimmed]);
    }
    setNewKeyword("");
  };

  const handleRemoveKeyword = async (word: string) => {
    const current = account?.comment_keywords ?? [];
    await onUpdateKeywords(current.filter((w) => w !== word));
  };

  const aiEnabled = account?.ai_enabled ?? true;
  const ordersEnabled = account?.ai_orders_enabled ?? true;
  const commentsEnabled = account?.comment_replies_enabled ?? true;
  const replyMode: InstagramCommentReplyMode =
    account?.comment_reply_mode ?? "PRIVATE";
  const keywords = account?.comment_keywords?.length
    ? account.comment_keywords
    : ["السعر", "تفاصيل", "متوفر", "بكم", "طلب", "price"];

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-lg font-bold">
              {t("smartSelling.title")}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t("smartSelling.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Toggle 1: Direct Message AI Assistant */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl border bg-muted/15 hover:bg-muted/30 transition-colors">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <Label className="text-sm font-bold cursor-pointer">
                {t("aiSettings.enableAi.label")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("aiSettings.enableAi.description")}
            </p>
          </div>
          <Switch
            checked={aiEnabled}
            onCheckedChange={onUpdateAiEnabled}
            disabled={disabled}
            className="shrink-0 mt-1"
          />
        </div>

        {/* Toggle 2: In-Chat Checkout & Orders */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl border bg-muted/15 hover:bg-muted/30 transition-colors">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-emerald-500 shrink-0" />
              <Label className="text-sm font-bold cursor-pointer">
                {t("aiSettings.enableOrders.label")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("aiSettings.enableOrders.description")}
            </p>
          </div>
          <Switch
            checked={ordersEnabled}
            onCheckedChange={onUpdateOrdersEnabled}
            disabled={disabled}
            className="shrink-0 mt-1"
          />
        </div>
      </div>

      {/* Toggle 3: Comment-to-DM Automation */}
      <div className="p-5 rounded-xl border bg-muted/15 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500 shrink-0" />
              <Label className="text-sm font-bold cursor-pointer">
                {t("comments.enable.label")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("comments.enable.description")}
            </p>
          </div>
          <Switch
            checked={commentsEnabled}
            onCheckedChange={onUpdateCommentsEnabled}
            disabled={disabled}
            className="shrink-0 mt-1"
          />
        </div>

        {/* How a matching comment is answered */}
        {commentsEnabled && (
          <div className="pt-3 border-t space-y-2">
            <Label className="text-xs font-semibold text-foreground/90">
              {t("comments.mode.label")}
            </Label>
            <Select
              value={replyMode}
              onValueChange={(value) =>
                void onUpdateCommentReplyMode(value as InstagramCommentReplyMode)
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-9 w-full max-w-md text-xs rounded-xl">
                <SelectValue>{t(`comments.mode.options.${replyMode}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COMMENT_REPLY_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {t(`comments.mode.options.${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(`comments.mode.hints.${replyMode}`)}
            </p>
          </div>
        )}

        {/* Trigger Keywords Chips */}
        {commentsEnabled && (
          <div className="pt-3 border-t space-y-3">
            <Label className="text-xs font-semibold text-foreground/90">
              {t("comments.keywords.label")}
            </Label>

            <form onSubmit={handleAddKeyword} className="flex gap-2 max-w-md">
              <Input
                placeholder={t("comments.keywords.placeholder")}
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                disabled={disabled}
                className="text-xs rounded-xl h-9"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={disabled || !newKeyword.trim()}
                className="text-xs shrink-0 rounded-xl h-9 px-3"
              >
                <Plus className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                {t("comments.keywords.add")}
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 pt-1">
              {keywords.map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background text-xs font-medium border shadow-2xs text-foreground group"
                >
                  <span>{word}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(word)}
                    disabled={disabled}
                    className="text-muted-foreground hover:text-destructive text-sm font-bold ltr:ml-1 rtl:mr-1 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
