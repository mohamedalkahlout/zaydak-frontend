"use client";

import { useTranslations } from "next-intl";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Link2,
  Radio,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { FaInstagram } from "react-icons/fa6";

interface InstagramSetupStepperProps {
  isConnected: boolean;
  username?: string | null;
  aiEnabled: boolean;
  linkedProductsCount: number;
  ordersEnabled: boolean;
}

export function InstagramSetupStepper({
  isConnected,
  username,
  aiEnabled,
  linkedProductsCount,
  ordersEnabled,
}: InstagramSetupStepperProps) {
  const t = useTranslations("settings.instagram.setupJourney");

  const STEPS = [
    {
      num: 1,
      title: t("step1"),
      status: isConnected
        ? username
          ? `@${username}`
          : t("completed")
        : t("inProgress"),
      done: isConnected,
      icon: FaInstagram,
    },
    {
      num: 2,
      title: t("step2"),
      status: aiEnabled ? t("completed") : t("inProgress"),
      done: aiEnabled,
      icon: Bot,
    },
    {
      num: 3,
      title: t("step3"),
      status:
        linkedProductsCount > 0
          ? `${linkedProductsCount} منتج مرتبط`
          : t("inProgress"),
      done: linkedProductsCount > 0,
      icon: Link2,
    },
    {
      num: 4,
      title: t("step4"),
      status: ordersEnabled ? t("ready") : t("inProgress"),
      done: ordersEnabled,
      icon: ShoppingBag,
    },
  ];

  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
        <h3 className="font-heading text-sm sm:text-base font-bold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("title")}
        </h3>
        <span className="text-xs text-muted-foreground">
          {isConnected && aiEnabled && ordersEnabled && linkedProductsCount > 0
            ? "القناة مكتملة الإعداد ونشطة بالكامل"
            : "خطوات بسيطة لإتمام تفعيل البيع الذكي"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={idx}
              className={`relative flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                step.done
                  ? "bg-emerald-500/5 border-emerald-500/30 text-card-foreground"
                  : "bg-muted/30 border-border text-muted-foreground"
              }`}
            >
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                  step.done
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-muted text-muted-foreground border"
                }`}
              >
                {step.done ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : (
                  <span>{step.num}</span>
                )}
              </div>

              <div className="min-w-0 space-y-0.5">
                <p
                  className={`text-xs font-bold truncate ${
                    step.done ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </p>
                <p
                  className={`text-[11px] truncate font-medium ${
                    step.done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/80"
                  }`}
                >
                  {step.status}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
