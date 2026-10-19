"use client";

import { useState } from "react";
import Image from "@/shared/components/app-image";
import { useFormatter, useTranslations } from "next-intl";
import {
  CheckCircle2,
  Film,
  Heart,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  ShoppingBag,
  Unlink,
} from "lucide-react";
import { FaInstagram } from "react-icons/fa6";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import type { InstagramPostItem } from "../types";

interface InstagramPostsHubProps {
  posts: InstagramPostItem[];
  /** The account's posts are being read from Instagram. */
  loading?: boolean;
  /** No account connected: there are no posts to show yet. */
  connected?: boolean;
  onTagPost: (post: InstagramPostItem) => void;
  onUnlinkPost: (postId: string) => void;
  currency?: string;
}

export function InstagramPostsHub({
  posts,
  loading = false,
  connected = true,
  onTagPost,
  onUnlinkPost,
  currency = "ر.س",
}: InstagramPostsHubProps) {
  const t = useTranslations("settings.instagram.postsHub");
  const format = useFormatter();
  const postedOn = (iso: string) => {
    const date = iso ? new Date(iso) : null;
    return date && !Number.isNaN(date.getTime())
      ? format.dateTime(date, { dateStyle: "medium" })
      : "";
  };
  const [filter, setFilter] = useState<"ALL" | "LINKED" | "UNLINKED">("ALL");
  const [unlinkConfirmPostId, setUnlinkConfirmPostId] = useState<string | null>(null);

  const linkedCount = posts.filter((p) => Boolean(p.linked_product)).length;
  const unlinkedCount = posts.length - linkedCount;

  const filteredPosts = posts.filter((p) => {
    if (filter === "LINKED") return Boolean(p.linked_product);
    if (filter === "UNLINKED") return !p.linked_product;
    return true;
  });

  const formatPrice = (cents: number) => {
    const amount = (cents / 100).toLocaleString("ar-SA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${amount} ${currency}`;
  };

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* ── Section Header ────────────────────────────────────────── */}
      <div className="p-6 border-b bg-muted/15 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
              <FaInstagram className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-lg font-bold tracking-tight">
              {t("title")}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {t("description")}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-muted/50 border gap-1 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === "ALL"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("filterAll")} ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("LINKED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              filter === "LINKED"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t("filterLinked", { count: linkedCount })}
          </button>
          <button
            type="button"
            onClick={() => setFilter("UNLINKED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              filter === "UNLINKED"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {t("filterUnlinked", { count: unlinkedCount })}
          </button>
        </div>
      </div>

      {/* ── Posts Grid ────────────────────────────────────────────── */}
      <div className="p-6">
        {filteredPosts.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground space-y-3">
            {loading ? (
              <RefreshCw className="h-10 w-10 mx-auto opacity-40 animate-spin" />
            ) : (
              <ImageIcon className="h-10 w-10 mx-auto opacity-40" />
            )}
            <p className="text-sm font-medium">
              {!connected
                ? t("notConnected")
                : loading
                  ? t("loading")
                  : t("emptyNotice")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const isLinked = Boolean(post.linked_product);
              const product = post.linked_product;

              return (
                <div
                  key={post.id}
                  className="group flex flex-col rounded-2xl border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 border-border/80"
                >
                  {/* Media Visual Container */}
                  <div
                    onClick={() => onTagPost(post)}
                    className="relative aspect-square w-full bg-muted overflow-hidden cursor-pointer"
                  >
                    {post.media_url ? (
                      <Image
                        src={post.media_url}
                        alt={post.caption}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-10 w-10 opacity-40" />
                      </div>
                    )}

                    {/* Gradient Overlay for Top Badges */}
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

                    {/* Top Status Badge */}
                    <div className="absolute top-3 ltr:left-3 rtl:right-3 flex items-center gap-2">
                      {isLinked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/90 text-white backdrop-blur-md shadow-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("statusLinked")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 text-white/90 backdrop-blur-md border border-white/10">
                          {t("statusUnlinked")}
                        </span>
                      )}
                    </div>

                    {/* Media Type Icon (Reel/Video indicator) */}
                    {post.media_type === "VIDEO" && (
                      <div className="absolute top-3 ltr:right-3 rtl:left-3 p-1.5 rounded-full bg-black/60 text-white backdrop-blur-md">
                        <Film className="h-3.5 w-3.5" />
                      </div>
                    )}

                    {/* Hover Prompt Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                      <Button
                        size="sm"
                        className="bg-white/90 hover:bg-white text-black font-semibold text-xs shadow-lg backdrop-blur-md rounded-xl"
                      >
                        {isLinked ? t("changeAction") : t("linkAction")}
                      </Button>
                    </div>
                  </div>

                  {/* Post Caption & Meta Snippet */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {post.caption}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3 text-red-500/80 fill-red-500/80" />
                          {format.number(post.like_count ?? 0)}
                        </span>
                        <span>{postedOn(post.timestamp)}</span>
                      </div>
                    </div>

                    {/* Linked Product Card OR Tag Prompt Button */}
                    <div className="pt-2 border-t">
                      {isLinked && product ? (
                        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-muted/40 border group-hover:border-primary/20 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0 border bg-background">
                              {product.image ? (
                                <Image
                                  src={product.image}
                                  alt={product.name}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                  <ShoppingBag className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-xs font-semibold text-foreground truncate">
                                {product.name}
                              </p>
                              <p className="text-xs font-bold text-primary">
                                {formatPrice(product.sale_price_cents ?? product.price_cents)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTagPost(post)}
                              className="h-8 px-2 text-[11px] hover:text-primary font-medium"
                            >
                              {t("changeAction")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUnlinkConfirmPostId(post.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onTagPost(post)}
                          className="w-full text-xs font-semibold border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 text-primary rounded-xl h-10"
                        >
                          <Plus className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                          {t("linkAction")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Unlink Confirmation Dialog ────────────────────────────── */}
      <Dialog
        open={Boolean(unlinkConfirmPostId)}
        onOpenChange={(open) => !open && setUnlinkConfirmPostId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {t("unlinkAction")}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              {t("unlinkConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnlinkConfirmPostId(null)}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (unlinkConfirmPostId) {
                  onUnlinkPost(unlinkConfirmPostId);
                  setUnlinkConfirmPostId(null);
                }
              }}
              className="text-xs"
            >
              تأكيد فك الربط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
