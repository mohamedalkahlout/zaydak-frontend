"use client";

import { useEffect, useId, useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useTranslations } from "next-intl";
import { InfoIcon } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";

import {
  GET_MY_SHOPS,
  IS_SHOP_SLUG_AVAILABLE,
  UPDATE_SHOP,
} from "@/features/shops/api";
import { useSwitchShop } from "@/shared/hooks/use-switch-shop";

import { STOREFRONT_HOST } from "../../lib/domain-urls";
import {
  MIN_HANDLE,
  handlePreview,
  handleProblem,
  normalizeHandle,
} from "../../lib/shop-handle";
import type { SettingsShop } from "../../types";

/**
 * A value that lags its input until it stops changing.
 *
 * Local to this dialog because it exists for one reason: the availability
 * check is a network round trip and a vendor typing a handle would otherwise
 * fire one per character, with the answers arriving out of order.
 */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/**
 * "Change your store address" — the shop's handle.
 *
 * The handle is the storefront URL *and* the `X-SHOP` key every request from
 * this dashboard carries, so it is the one setting that cannot be a field in
 * the General pane's batched save: committing it moves the very route the
 * form is standing on. It gets a dialog, an explicit confirm, and a redirect.
 *
 * It is also why `updateShop` no longer re-derives the handle from `name` —
 * a rename used to change the public URL as a side effect, breaking every link
 * anyone had shared, with nothing on screen saying so. Now this dialog owns
 * it, and the old handle is retired rather than dropped: it keeps resolving,
 * stays reserved against every other shop, and the storefront redirects it.
 */
export function ChangeAddressDialog({
  open,
  onOpenChange,
  shop,
  platformRoot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shop: SettingsShop;
  /**
   * The apex the *server* builds this shop's address from, or null when the
   * deployment is path-scoped.
   *
   * Passed in rather than read from this app's own environment, because the
   * preview here and the address listed in the table behind the dialog are the
   * same claim and were reading it from two different variables — which meant
   * "your store will be at x" could name an address the table on the same
   * screen did not list.
   */
  platformRoot: string | null;
}) {
  const t = useTranslations("settings.domains");
  const apollo = useApolloClient();
  const switchShop = useSwitchShop();
  const inputId = useId();

  const current = shop.slug;

  // Re-seeded from the current handle each time the dialog opens, during
  // render rather than in an effect, so the input never commits a frame
  // holding the text from the last time it was open.
  const [handle, setHandle] = useState(current);
  const [seededFor, setSeededFor] = useState<boolean>(open);
  if (seededFor !== open) {
    setSeededFor(open);
    if (open) setHandle(current);
  }

  const [update, { loading: saving }] = useMutation(UPDATE_SHOP);

  const trimmed = handle.trim();
  const unchanged = trimmed === current;
  const problem = handleProblem(trimmed);

  /**
   * Ask the server whether the handle is free, once the shape is right.
   *
   * Skipped while the shape is wrong (there is already a message on screen)
   * and while the handle is unchanged (a shop's own handle is trivially
   * "taken" to anyone but `excludeShopId`, and asking would flash a conflict
   * on a dialog the vendor just opened).
   */
  const debounced = useDebounced(trimmed, 400);
  const checking = debounced !== trimmed && !problem && !unchanged;
  const { data: availability, loading: checkingServer } = useQuery(
    IS_SHOP_SLUG_AVAILABLE,
    {
      variables: { slug: debounced, excludeShopId: shop.id },
      skip: !open || !!problem || unchanged || debounced.length < MIN_HANDLE,
      fetchPolicy: "network-only",
    },
  );

  // Only trust an answer that is about the handle currently in the box.
  const settled = !checking && !checkingServer;
  const taken =
    settled &&
    debounced === trimmed &&
    (availability as { isShopSlugAvailable?: boolean } | undefined)
      ?.isShopSlugAvailable === false;

  const error = problem
    ? problem === "tooShort"
      ? t("errors.tooShort", { min: MIN_HANDLE })
      : t(`errors.${problem}`)
    : taken
      ? t("errors.taken")
      : null;

  // Never on an unsettled check: a button that enables for a moment between
  // keystrokes is a button that submits a handle the server has not cleared.
  const canSave =
    trimmed.length >= MIN_HANDLE && !problem && !unchanged && settled && !taken;

  async function save() {
    if (!canSave) return;
    try {
      const { data } = await update({
        // Addressed by the handle it still has; the new one is the patch.
        variables: { slug: shop.slug, input: { slug: trimmed } },
      });
      const next = (
        data as { updateShop?: { data?: { slug?: string } } } | undefined
      )?.updateShop?.data?.slug;
      if (!next) return;

      onOpenChange(false);
      sileo.success({ title: t("changed"), description: next });

      // Refresh the shop list *before* the slug moves, and let it settle.
      // Writing the active-shop store is what ShopCacheBoundary watches, and
      // its `clearStore()` rejects every fetch still in the link chain with
      // "Store reset while query was in flight" — so a refetch straddling that
      // write raced it, and `GET_MY_SHOPS` is a live `useSuspenseQuery` in
      // DashboardShell, which means the rejection was thrown at render rather
      // than caught here. Running it first is also exact: `myShops` is guarded
      // by `JwtAuthGuard` alone and reads no `X-SHOP`, so the old handle on the
      // header cannot scope it. `switchShop` then holds for anything else still
      // out before it writes the slug and moves the route.
      //
      // Its own catch: the rename already committed, so a failed list refresh
      // must not raise an error toast or strand us on the route that is gone.
      try {
        await apollo.refetchQueries({ include: [GET_MY_SHOPS] });
      } catch {
        // Stale list until the next fetch; the redirect below is what matters.
      }

      // The route we are standing on no longer exists.
      await switchShop(next, {
        href: `/store/${next}/settings/domains`,
        replace: true,
      });
    } catch (err) {
      sileo.error({ title: (err as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("change.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("change.dialogBody")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t("change.label")}
          </label>
          <Input
            id={inputId}
            value={handle}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error || undefined}
            onChange={(e) => setHandle(normalizeHandle(e.target.value))}
            className="h-11 rounded-lg text-base"
          />
          {/* The whole URL, not the handle alone: what changes here is the
              address, and the address is the thing worth reading back. */}
          <p className="truncate text-sm text-muted-foreground" dir="ltr">
            {handlePreview(trimmed, STOREFRONT_HOST, platformRoot)}
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        {/* Reassurance, not a warning: the old handle is retired into
            `shop_slug_history` and keeps resolving, so this says what
            actually happens rather than warning about what used to. */}
        <div className="flex gap-2.5 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <p>{t("change.warning")}</p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("change.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!canSave || saving}
          >
            {saving
              ? t("change.saving")
              : !settled && !problem && !unchanged
                ? t("change.checking")
                : t("change.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
