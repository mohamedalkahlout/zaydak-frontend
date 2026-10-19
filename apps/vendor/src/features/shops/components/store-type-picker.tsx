"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@repo/ui/lib/utils";

import {
  STORE_TYPE_LABEL_KEYS,
  STORE_TYPES,
  type StoreType,
} from "../lib/store-types";

/**
 * The type chips on `/create-store` and on signup's last pane. One control,
 * two callers, so the screens cannot drift apart.
 */
export function StoreTypePicker({
  value,
  onChange,
}: {
  value: StoreType[];
  onChange: (types: StoreType[]) => void;
}) {
  const t = useTranslations("createStore");

  return (
    <div className="flex flex-wrap gap-2.5">
      {STORE_TYPES.map((type) => {
        const selected = value.includes(type);
        return (
          <button
            key={type}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(
                selected
                  ? value.filter((current) => current !== type)
                  : [...value, type],
              )
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:text-base",
              selected
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
            )}
          >
            {selected ? (
              <CheckIcon className="size-4" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            {t(STORE_TYPE_LABEL_KEYS[type])}
          </button>
        );
      })}
    </div>
  );
}
