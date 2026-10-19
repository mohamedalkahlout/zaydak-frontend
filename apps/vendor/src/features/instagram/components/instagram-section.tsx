"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Loader2, RefreshCw, Unplug } from "lucide-react";
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
import { Skeleton } from "@repo/ui/components/skeleton";
import { useSettingsShop } from "@/features/settings";

import {
  GET_MY_SHOP_INSTAGRAM_ACCOUNT,
  CONNECT_SHOP_INSTAGRAM_ACCOUNT,
  CHECK_SHOP_INSTAGRAM_HEALTH,
  DISCONNECT_SHOP_INSTAGRAM_ACCOUNT,
  UPDATE_SHOP_INSTAGRAM_SETTINGS,
  MAP_INSTAGRAM_MEDIA_TO_PRODUCT,
  UNMAP_INSTAGRAM_MEDIA,
  GET_MY_SHOP_INSTAGRAM_POSTS,
  GET_MY_SHOP_INSTAGRAM_STATS,
} from "../api";
import type {
  MyShopInstagramAccountResult,
  ConnectShopInstagramAccountResult,
  CheckShopInstagramHealthResult,
  DisconnectShopInstagramAccountResult,
  UpdateShopInstagramSettingsResult,
  MapInstagramMediaToProductResult,
  UnmapInstagramMediaResult,
  MyShopInstagramPostsResult,
  MyShopInstagramStatsResult,
  InstagramCommentReplyMode,
  InstagramPostItem,
  InstagramPostResult,
  LinkedProductInfo,
} from "../types";

import { InstagramKpiStats } from "./instagram-kpi-stats";
import { InstagramSetupStepper } from "./instagram-setup-stepper";
import { InstagramSmartSellingCard } from "./instagram-smart-selling-card";
import { InstagramAssistantCard } from "./instagram-assistant-card";
import { InstagramPostsHub } from "./instagram-posts-hub";
import { InstagramProductPickerDialog } from "./instagram-product-picker-dialog";
import { InstagramAdvancedMapping } from "./instagram-advanced-mapping";

/** A product's `{ en, ar }` name in the dashboard's language. */
function localizedName(name: unknown, locale: string): string {
  if (typeof name === "string") return name;
  if (name && typeof name === "object") {
    const record = name as Record<string, unknown>;
    const pick = record[locale] ?? record.ar ?? record.en;
    if (typeof pick === "string") return pick;
  }
  return "";
}

/** A server post as the posts grid shows it. */
function toPostItem(post: InstagramPostResult, locale: string): InstagramPostItem {
  const product = post.linked_product;
  return {
    id: post.id,
    media_type: post.media_type,
    media_url: post.media_url ?? "",
    permalink: post.permalink ?? "",
    caption: post.caption,
    timestamp: post.created_at ?? "",
    like_count: post.like_count,
    comments_count: post.comment_count,
    linked_product: product
      ? {
          id: product.id,
          name: localizedName(product.name, locale),
          price_cents: product.price_cents,
          sale_price_cents: product.sale_price_cents,
          image: product.image_url,
          slug: product.slug,
          in_stock: product.in_stock,
          quantity: product.quantity,
        }
      : null,
  };
}

export function InstagramSection() {
  const t = useTranslations("settings.instagram");
  const locale = useLocale();
  const shop = useSettingsShop();
  const currency = shop?.currency || "ر.س";

  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [selectedPostForTagging, setSelectedPostForTagging] =
    useState<InstagramPostItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // GraphQL Account Query & Mutations
  const { data, loading, refetch } = useQuery<MyShopInstagramAccountResult>(
    GET_MY_SHOP_INSTAGRAM_ACCOUNT,
    { fetchPolicy: "network-only" }
  );

  const [startConnect, { loading: authLoading }] =
    useMutation<ConnectShopInstagramAccountResult>(
      CONNECT_SHOP_INSTAGRAM_ACCOUNT
    );

  const [checkHealth, { loading: checkingHealth }] =
    useMutation<CheckShopInstagramHealthResult>(CHECK_SHOP_INSTAGRAM_HEALTH, {
      onCompleted() {
        void refetch();
      },
    });

  // The callback sends the merchant back here with `?instagram=connected` or
  // `?instagram=error&reason=<code>`. Read once into state, then the query is
  // taken off the URL so a reload does not repeat it.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(() => {
    const result = searchParams.get("instagram");
    if (result === "connected") {
      return { kind: "success", text: t("notice.connected") };
    }
    if (result === "error") {
      // A reason the merchant can act on gets its own sentence; anything
      // else is shown as the code, inside the generic one.
      const reason = searchParams.get("reason") ?? "unknown";
      const key = `notice.reasons.${reason}`;
      return {
        kind: "error",
        text: t.has(key)
          ? t(key)
          : t("notice.connectFailed", { reason }),
      };
    }
    return null;
  });
  useEffect(() => {
    if (searchParams.get("instagram")) router.replace(pathname);
  }, [searchParams, router, pathname]);

  const [disconnectAccount, { loading: disconnecting }] =
    useMutation<DisconnectShopInstagramAccountResult>(
      DISCONNECT_SHOP_INSTAGRAM_ACCOUNT,
      {
        onCompleted() {
          setDisconnectOpen(false);
          void refetch();
        },
      }
    );

  const [updateSettings, { loading: updatingSettings }] =
    useMutation<UpdateShopInstagramSettingsResult>(
      UPDATE_SHOP_INSTAGRAM_SETTINGS,
      {
        onCompleted() {
          void refetch();
        },
      }
    );

  const [mapMediaMutation, { loading: mappingMedia }] =
    useMutation<MapInstagramMediaToProductResult>(
      MAP_INSTAGRAM_MEDIA_TO_PRODUCT
    );

  const account = data?.myShopInstagramAccount;
  // The server's verdict only. A failed connect never shows as connected.
  const isConnected = Boolean(account?.connected);
  const needsReconnect = account?.status === "needs_reconnect";
  const displayUsername = account?.instagram_username || "";

  // The account's real posts (live from Instagram, cached a minute on the
  // server) and the figures from the delivery ledger. Neither is asked for
  // until an account is connected.
  const {
    data: postsData,
    loading: postsLoading,
    error: postsError,
    refetch: refetchPosts,
  } = useQuery<MyShopInstagramPostsResult>(GET_MY_SHOP_INSTAGRAM_POSTS, {
    skip: !isConnected,
    fetchPolicy: "network-only",
  });
  const { data: statsData, refetch: refetchStats } =
    useQuery<MyShopInstagramStatsResult>(GET_MY_SHOP_INSTAGRAM_STATS, {
      skip: !isConnected,
      fetchPolicy: "network-only",
    });
  const [unmapMedia] = useMutation<UnmapInstagramMediaResult>(
    UNMAP_INSTAGRAM_MEDIA
  );

  const posts = useMemo(
    () =>
      (postsData?.myShopInstagramPosts ?? []).map((post) =>
        toPostItem(post, locale)
      ),
    [postsData, locale]
  );
  const stats = statsData?.myShopInstagramStats ?? null;

  const refreshLinks = () => {
    void refetchPosts();
    void refetchStats();
  };

  // Actions
  const handleConnect = async () => {
    if (account && !account.available) {
      setNotice({ kind: "error", text: t("notice.unavailable") });
      return;
    }
    try {
      const res = await startConnect();
      const url = res.data?.connectShopInstagramAccount.authorization_url;
      if (!url) throw new Error("no authorization URL");
      // Zernio's Instagram consent screen; it returns to the API callback,
      // which sends the merchant back to this page.
      window.location.assign(url);
    } catch {
      setNotice({
        kind: "error",
        text: t("notice.connectFailed", { reason: "connect_unavailable" }),
      });
    }
  };

  const handleCheckHealth = async () => {
    try {
      await checkHealth();
    } catch {
      setNotice({ kind: "error", text: t("notice.healthFailed") });
    }
  };

  const handleDisconnect = async () => {
    await disconnectAccount();
  };

  const handleUpdateAiEnabled = async (enabled: boolean) => {
    await updateSettings({ variables: { input: { ai_enabled: enabled } } });
  };

  const handleUpdateOrdersEnabled = async (enabled: boolean) => {
    await updateSettings({
      variables: { input: { ai_orders_enabled: enabled } },
    });
  };

  const handleUpdateCommentsEnabled = async (enabled: boolean) => {
    await updateSettings({
      variables: { input: { comment_replies_enabled: enabled } },
    });
  };

  const handleUpdateKeywords = async (keywords: string[]) => {
    await updateSettings({
      variables: { input: { comment_keywords: keywords } },
    });
  };

  const handleUpdateCommentReplyMode = async (
    mode: InstagramCommentReplyMode
  ) => {
    await updateSettings({
      variables: { input: { comment_reply_mode: mode } },
    });
  };

  // Tagging Product to a Post
  const handleOpenTagDialog = (post: InstagramPostItem) => {
    setSelectedPostForTagging(post);
    setPickerOpen(true);
  };

  // The grid shows what the server holds: a link is saved, then the posts are
  // read back, so a refused link never looks linked.
  const handleSelectProductForPost = async (product: LinkedProductInfo) => {
    if (!selectedPostForTagging) return;
    try {
      await mapMediaMutation({
        variables: {
          input: {
            media_id: selectedPostForTagging.id,
            product_id: product.id,
          },
        },
      });
      refreshLinks();
    } catch {
      setNotice({ kind: "error", text: t("notice.linkFailed") });
    }
  };

  const handleUnlinkPost = async (postId: string) => {
    try {
      await unmapMedia({ variables: { input: { media_id: postId } } });
      refreshLinks();
    } catch {
      setNotice({ kind: "error", text: t("notice.linkFailed") });
    }
  };

  const handleManualMap = async ({
    mediaId,
    productId,
  }: {
    mediaId: string;
    productId: string;
    permalink?: string;
  }) => {
    await mapMediaMutation({
      variables: {
        input: {
          media_id: mediaId,
          product_id: productId,
        },
      },
    });
    refreshLinks();
  };

  // All the shop's links, not only those among the 25 posts on screen.
  const linkedCount =
    stats?.linked_posts ?? posts.filter((p) => Boolean(p.linked_product)).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Top Channel Header / Hero Card ─────────────────────────── */}
      <div className="rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
        <div className="p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-5 bg-muted/15">
          <div className="flex items-center gap-4">
            <div className="relative p-3 rounded-2xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-md">
              <FaInstagram className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">
                  {t("title")}
                </h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t("status.connected")}
                  </span>
                ) : needsReconnect ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {t("status.actionRequired")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border">
                    {t("status.disconnected")}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {t("subtitle")}
              </p>
            </div>
          </div>

          {/* Account Profile Pill & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isConnected ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-background/80 shadow-2xs">
                  <span className="font-mono text-xs font-bold text-foreground">
                    @{displayUsername}
                  </span>
                  <a
                    href={`https://instagram.com/${displayUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    title={t("actions.viewProfile")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckHealth}
                  disabled={checkingHealth}
                  className="text-xs rounded-xl h-9"
                >
                  {checkingHealth ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin ltr:mr-1 rtl:ml-1" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                  )}
                  {t("actions.sync")}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisconnectOpen(true)}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl h-9"
                >
                  <Unplug className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                  {t("actions.disconnect")}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={authLoading}
                className="bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-90 text-white font-semibold text-xs rounded-xl h-10 px-4 shadow-sm"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin ltr:mr-1.5 rtl:ml-1.5" />
                ) : (
                  <FaInstagram className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                )}
                {needsReconnect ? t("actions.reconnect") : t("actions.connect")}
              </Button>
            )}
          </div>
        </div>
        {notice || (needsReconnect && account?.last_error) ? (
          <div
            role="status"
            className={
              notice?.kind === "success"
                ? "px-6 py-3 text-xs sm:text-sm border-t bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                : "px-6 py-3 text-xs sm:text-sm border-t bg-amber-500/5 text-amber-800 dark:text-amber-300"
            }
          >
            {notice ? notice.text : t("notice.reconnectNeeded")}
          </div>
        ) : null}
      </div>

      {/* ── Setup Journey Stepper (تسلسل الإعداد) ──────────────────── */}
      <InstagramSetupStepper
        isConnected={isConnected}
        username={displayUsername}
        aiEnabled={account?.ai_enabled ?? true}
        linkedProductsCount={linkedCount}
        ordersEnabled={account?.ai_orders_enabled ?? true}
      />

      {/* ── Business Value & KPI Performance Cards (إحصائيات القيمة) ─ */}
      <InstagramKpiStats stats={stats} />

      {/* ── Smart Selling & AI Settings (إعدادات البيع الذكي) ──────── */}
      <InstagramSmartSellingCard
        account={account ?? null}
        onUpdateAiEnabled={handleUpdateAiEnabled}
        onUpdateOrdersEnabled={handleUpdateOrdersEnabled}
        onUpdateCommentsEnabled={handleUpdateCommentsEnabled}
        onUpdateKeywords={handleUpdateKeywords}
        onUpdateCommentReplyMode={handleUpdateCommentReplyMode}
        disabled={updatingSettings}
      />

      {/* ── Assistant behaviour: instructions + human takeover (save bar) ── */}
      <InstagramAssistantCard account={account ?? null} />

      {/* ── Visual Posts & Tagging Hub (ربط المنتجات بالمنشورات) ───── */}
      {postsError ? (
        <div
          role="status"
          className="rounded-2xl border px-6 py-4 text-xs sm:text-sm bg-amber-500/5 text-amber-800 dark:text-amber-300"
        >
          {t("postsHub.loadFailed")}
        </div>
      ) : null}
      <InstagramPostsHub
        posts={posts}
        loading={postsLoading}
        connected={isConnected}
        onTagPost={handleOpenTagDialog}
        onUnlinkPost={handleUnlinkPost}
        currency={currency}
      />

      {/* ── Product Picker Dialog (نافذة اختيار المنتج) ─────────────── */}
      <InstagramProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        post={selectedPostForTagging}
        onSelectProduct={handleSelectProductForPost}
        currency={currency}
      />

      {/* ── Advanced Settings Collapsible (إعدادات متقدمة للمطورين) ─── */}
      <InstagramAdvancedMapping
        onManualMap={handleManualMap}
        loading={mappingMedia}
      />

      {/* ── Disconnect Modal ───────────────────────────────────────── */}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {t("disconnectDialog.title")}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {t("disconnectDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisconnectOpen(false)}
              disabled={disconnecting}
              className="text-xs"
            >
              {t("disconnectDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDisconnect()}
              disabled={disconnecting}
              className="text-xs"
            >
              {disconnecting && (
                <Loader2 className="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5" />
              )}
              {t("disconnectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
