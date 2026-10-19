"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Bot, MessageCircle, MessageSquare, Zap } from "lucide-react";

import type { InstagramStats } from "../types";

interface InstagramKpiStatsProps {
  /** Null until an account is connected and the figures have loaded. */
  stats: InstagramStats | null;
}

/**
 * The last 30 days on Instagram, counted by the server from what it actually
 * received and sent. A figure it cannot know — orders placed after a link, a
 * trend against a previous period — is not shown rather than estimated.
 */
export function InstagramKpiStats({ stats }: InstagramKpiStatsProps) {
  const t = useTranslations("settings.instagram.stats");
  const format = useFormatter();
  const value = (n: number | undefined) =>
    n === undefined ? "—" : format.number(n);

  const cards = [
    {
      title: t("conversations.title"),
      value: value(stats?.conversations),
      subtitle: t("conversations.desc"),
      icon: MessageCircle,
      iconBg: "bg-blue-500 text-white",
    },
    {
      title: t("answered.title"),
      value: value(stats?.messages_answered),
      subtitle: t("answered.desc", {
        received: format.number(stats?.messages_received ?? 0),
      }),
      icon: Bot,
      iconBg: "bg-purple-500 text-white",
    },
    {
      title: t("comments.title"),
      value: value(stats?.comments_answered),
      subtitle: t("comments.desc"),
      icon: MessageSquare,
      iconBg: "bg-emerald-500 text-white",
    },
    {
      title: t("replyRate.title"),
      value:
        stats?.reply_rate === null || stats?.reply_rate === undefined
          ? "—"
          : `${format.number(stats.reply_rate)}%`,
      subtitle: t("replyRate.desc"),
      icon: Zap,
      iconBg: "bg-amber-500 text-white",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="group relative rounded-2xl border bg-card p-5 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-xl ${card.iconBg} shadow-xs`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted border text-muted-foreground">
                {t("window", { days: stats?.window_days ?? 30 })}
              </span>
            </div>

            <div className="mt-4 space-y-1">
              <h4 className="text-2xl font-bold tracking-tight text-foreground">
                {card.value}
              </h4>
              <p className="text-xs font-semibold text-foreground/80">
                {card.title}
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
