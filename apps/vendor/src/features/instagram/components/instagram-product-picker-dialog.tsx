"use client";

import { useMemo, useState } from "react";
import Image from "@/shared/components/app-image";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@apollo/client/react";
import {
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Package,
  Search,
  Sparkles,
} from "lucide-react";

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
import { Badge } from "@repo/ui/components/badge";
import { GET_PRODUCTS } from "@/features/products/api";
import type { ProductsResponse } from "@/features/products/types";
import type { InstagramPostItem, LinkedProductInfo } from "../types";

interface InstagramProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: InstagramPostItem | null;
  onSelectProduct: (product: LinkedProductInfo) => void;
  currency?: string;
}

export function InstagramProductPickerDialog({
  open,
  onOpenChange,
  post,
  onSelectProduct,
  currency = "ر.س",
}: InstagramProductPickerDialogProps) {
  const t = useTranslations("settings.instagram.picker");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LinkedProductInfo | null>(
    post?.linked_product ?? null
  );

  // Fetch real shop products
  const { data: productsData, loading } = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: {
      filters: {
        limit: 30,
      },
    },
    fetchPolicy: "cache-first",
  });

  const availableProducts = useMemo<LinkedProductInfo[]>(() => {
    const rawProducts = productsData?.products?.data;
    if (rawProducts && rawProducts.length > 0) {
      return rawProducts.map((p) => ({
        id: p.id,
        // A product name is stored per language; the picker shows one.
        name:
          typeof p.name === "string"
            ? p.name
            : ((locale === "ar" ? p.name?.ar : p.name?.en) ??
              p.name?.en ??
              p.name?.ar ??
              ""),
        price_cents: p.price_cents ?? 0,
        sale_price_cents: p.sale_price_cents,
        image: p.image?.thumbnail ?? p.image?.original ?? null,
        sku: p.sku,
        slug: p.slug,
        in_stock: p.in_stock,
        quantity: p.quantity ?? undefined,
      }));
    }
    // No sample products: linking one would name a product the shop does not
    // have, and the server refuses that.
    return [];
  }, [productsData, locale]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableProducts;
    return availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.slug && p.slug.toLowerCase().includes(q))
    );
  }, [availableProducts, search]);

  const handleConfirm = () => {
    if (!selected) return;
    onSelectProduct(selected);
    onOpenChange(false);
  };

  const formatPrice = (cents: number) => {
    const amount = (cents / 100).toLocaleString("ar-SA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${amount} ${currency}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl border shadow-2xl">
        {/* Header with Post Context */}
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("title")}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {t("description")}
              </DialogDescription>
            </div>
          </div>

          {/* Selected Post Preview Header Pill */}
          {post && (
            <div className="mt-3 flex items-center gap-3 p-2.5 rounded-xl border bg-background/80 shadow-xs">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0 bg-muted border">
                <Image
                  src={post.media_url}
                  alt={post.caption}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <span>{t("selectedPost")}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    #{post.id.slice(-6)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {post.caption || "منشور إنستغرام بدون وصف"}
                </p>
              </div>
              {post.linked_product && (
                <Badge variant="outline" className="text-[11px] shrink-0 text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                  مرتبط حالياً
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Search Bar */}
        <div className="p-4 border-b bg-background">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ltr:pl-9 rtl:pr-9 text-xs sm:text-sm h-10 rounded-xl bg-muted/40 focus:bg-background"
            />
          </div>
        </div>

        {/* Products List Scroll Area */}
        <div className="flex-1 overflow-y-auto max-h-[380px] p-4 space-y-2.5 bg-muted/10">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">جاري تحميل المنتجات من متجرك...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <Package className="h-8 w-8 mx-auto stroke-1 opacity-60" />
              <p className="text-sm font-medium">لم يتم العثور على منتجات مطابقة للبحث</p>
              <p className="text-xs text-muted-foreground">جرّب البحث باسم آخر أو رمز SKU</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isSelected = selected?.id === product.id;
              const hasDiscount =
                product.sale_price_cents &&
                product.sale_price_cents < product.price_cents;

              return (
                <div
                  key={product.id}
                  onClick={() => setSelected(product)}
                  className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                      : "bg-card hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Product Image */}
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-muted border">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          unoptimized
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6 opacity-40" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {product.sku && (
                          <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                            {product.sku}
                          </span>
                        )}
                        <span>
                          {product.in_stock !== false
                            ? t("inStock", { count: product.quantity ?? 10 })
                            : t("outOfStock")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price & Selection Button */}
                  <div className="ltr:text-right rtl:text-left shrink-0 ltr:pl-3 rtl:pr-3 flex flex-col items-end gap-1.5">
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-xs sm:text-sm text-foreground">
                        {formatPrice(
                          hasDiscount
                            ? product.sale_price_cents!
                            : product.price_cents
                        )}
                      </span>
                      {hasDiscount && (
                        <span className="text-[11px] text-muted-foreground line-through">
                          {formatPrice(product.price_cents)}
                        </span>
                      )}
                    </div>

                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30 group-hover:border-primary/50"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            {t("cancel")}
          </Button>

          <div className="flex items-center gap-2">
            {selected && (
              <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[200px]">
                {selected.name}
              </span>
            )}
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!selected}
              className="text-xs bg-primary hover:bg-primary/90 font-medium px-4"
            >
              <Check className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
              {t("confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
