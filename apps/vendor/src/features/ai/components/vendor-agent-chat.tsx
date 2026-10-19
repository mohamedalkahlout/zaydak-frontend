"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useInView } from "motion/react";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  MicIcon,
  MicOffIcon,
  PaperclipIcon,
  RefreshCwIcon,
  SparklesIcon,
  StopCircleIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { useVendorAgent } from "@/features/ai/lib/use-vendor-agent";
import {
  useChatUpload,
  type UploadedAttachment,
} from "@/features/ai/lib/use-chat-upload";
import { useVoiceInput } from "@/features/ai/lib/use-voice-input";
import { useMentionComposer } from "@/features/ai/lib/use-mention-composer";
import { hasPlan, latestPlan } from "@/features/ai/lib/task-plan";
import { TaskPlanStrip } from "@/features/ai/components/task-plan-strip";
import {
  mentionCategory as categoryDef,
  conversationTitleFrom,
  parseMentionTag,
  type MentionType,
} from "@/features/ai/lib/mention-config";
import { MentionDropdown } from "./mention-dropdown";
import { MentionChips } from "./mention-chips";
import { splitBubbleMentions } from "@/features/ai/lib/inline-mentions";
import {
  conversationToMarkdown,
  downloadMarkdown,
} from "@/features/ai/lib/export-markdown";
import { suggestFollowUps } from "@/features/ai/lib/suggest-follow-ups";
import { highlight } from "@/features/ai/lib/highlight";
import { isResumeTurn } from "@/features/ai/lib/resume-marker";
import { DailyBriefingCard } from "./daily-briefing-card";
import { WeeklyInsightsCard } from "./weekly-insights-card";
import SiriOrb from "@/components/smoothui/siri-orb";
import type {
  AgentApprovalDecision,
  AssistantPart,
  VendorAgentMessage,
  VendorAgentToolEvent,
} from "@/features/ai/lib/types";
import { AssistantTurn } from "./assistant-turn";
import { Transcript, TranscriptItem } from "./transcript";
import { ConversationsSidebar } from "./conversations-sidebar";
import { AgentOrb } from "./agent-orb";
import { COMPOSER_GRADIENT_COLORS } from "@/features/ai/lib/composer-halo";
import { NoiseBackground } from "@repo/ui/components/noise-background";
import { ShiningText } from "@repo/ui/components/shining-text";
import { useSafeReducedMotion } from "@repo/ui/hooks/use-hydrated";
import { useShopCurrency } from "@/shared/hooks/use-shop-currency";

/**
 * Matches the `[Attached images: url1, url2]` tag we inject into the
 * user's message before sending to the agent. Used here to split the
 * display text from the thumbnails when rendering past messages.
 */
const ATTACHMENTS_TAG_RE = /\n*\[Attached images:\s*([^\]]+)\]\s*$/;

function parseMessageContent(raw: string): {
  text: string;
  images: string[];
  mentions: Array<{ type: MentionType; display: string }>;
} {
  // The attachments tag is always the very last block — strip it first.
  let text = raw;
  let images: string[] = [];
  const am = text.match(ATTACHMENTS_TAG_RE);
  if (am) {
    images = am[1]
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    text = text.replace(ATTACHMENTS_TAG_RE, "");
  }
  // The [Referenced: …] mentions tag now sits at the tail (if present).
  const parsed = parseMentionTag(text);
  return { text: parsed.text, images, mentions: parsed.mentions };
}

interface Props {
  vendorName?: string | null;
}

type Lang = "ar" | "en";

/*
 * The starter prompts and quick actions.
 *
 * Only the labels are UI copy (`aiChat.page.categories` / `.quickActions`).
 * The prompts themselves are the message a tap sends to the assistant as the
 * vendor's own words — the model reads them, and they land in the transcript
 * as the vendor's bubble — so both languages stay here, picked by the
 * dashboard's locale, rather than in the message catalogue.
 */
interface PromptCategory {
  key: "create" | "insights" | "inventory";
  icon: string;
  prompts: Record<Lang, string[]>;
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    key: "create",
    icon: "✨",
    prompts: {
      ar: ["أضف منتج جديد", "اعمل قسم إلكترونيات", "أضف منتج رقمي للعملاء"],
      en: [
        "Add a new product",
        "Create an Electronics collection",
        "Add a digital product",
      ],
    },
  },
  {
    key: "insights",
    icon: "📊",
    prompts: {
      ar: [
        "وريني إحصائيات اليوم",
        "شو الأكثر مبيعاً؟",
        "قارن الشهر الحالي بالماضي",
      ],
      en: [
        "Show today's stats",
        "What's selling best?",
        "Compare this month vs last",
      ],
    },
  },
  {
    key: "inventory",
    icon: "📦",
    prompts: {
      ar: [
        "شو المنتجات اللي مخزونها ناقص؟",
        "وريني المنتجات الـ DRAFT",
        "ابحث عن منتج بالاسم",
      ],
      en: [
        "What's running low on stock?",
        "Show DRAFT products",
        "Search products by name",
      ],
    },
  },
];

const QUICK_ACTIONS: Array<{
  key: "stats" | "lowStock" | "topSellers" | "newProduct";
  icon: string;
  prompt: Record<Lang, string>;
}> = [
  {
    key: "stats",
    icon: "📊",
    prompt: { ar: "وريني إحصائيات اليوم", en: "Show today's stats" },
  },
  {
    key: "lowStock",
    icon: "📦",
    prompt: {
      ar: "شو المنتجات اللي مخزونها ناقص؟",
      en: "What's running low on stock?",
    },
  },
  {
    key: "topSellers",
    icon: "🏆",
    prompt: { ar: "شو المنتجات الأكثر مبيعاً؟", en: "What's selling best?" },
  },
  {
    key: "newProduct",
    icon: "+",
    prompt: { ar: "بدي أضيف منتج جديد", en: "I want to add a new product" },
  },
];

export function VendorAgentChat({ vendorName }: Props) {
  const t = useTranslations("aiChat");
  const tExport = useTranslations("aiChat.export");
  const locale = useLocale();
  // Was a prop defaulting to "USD", and the route passed "USD" too, so a
  // SAR shop read its own prices in dollars.
  const currency = useShopCurrency();
  const isAr = locale === "ar";
  const lang: Lang = isAr ? "ar" : "en";
  const {
    messages,
    streaming,
    sending,
    loadingHistory,
    error,
    conversationId,
    pendingApproval,
    send,
    regenerate,
    resolveApproval,
    stop,
    reset,
    switchConversation,
  } = useVendorAgent();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track which message ids we've already acted on. Seeded from the
  // hydrated history so loading a past conversation doesn't auto-navigate
  // to a form for an intent the vendor already consumed.
  // Following, anchoring, the opening position and the jump control all
  // belong to <Transcript> now — see components/transcript.tsx for what
  // the effect that used to live here got wrong.

  // There is deliberately NO auto-navigation here any more.
  //
  // This page used to push the vendor to the form 600ms after a
  // `navigate_to_form` reply landed, and the docked panel — the surface
  // almost everybody actually uses — never did. That asymmetry was the
  // whole bug: one card renders on both surfaces, and it told both vendors
  // the form was opening itself. The timer path also stashed only
  // `{target, values, entityId}` and silently dropped `place_stock_at` and
  // `next_step`, which the tool emits as siblings of `prefill` — so the
  // automatic route was the one that lost the vendor's warehouse answer and
  // could never finish a chained request begun here.
  //
  // Both surfaces now go through NavigateToFormCard's button, which stashes
  // the whole ticket and asks the leave guard first. A vendor reading an
  // order is not moved off it by something the assistant decided.

  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    upload,
    uploading: uploadInProgress,
    error: uploadError,
  } = useChatUpload();

  const voice = useVoiceInput();

  const prefersReducedMotion = useSafeReducedMotion();
  // Halo wrapper ref — lets us pause the WebGL render loop when off-screen.
  // Which turn owns the "To-dos" card, and what the pinned strip says. See
  // the identical derivation in ai-chat-panel.tsx and lib/task-plan.ts: a
  // turn cannot see its siblings, and the multi-step flow guarantees the
  // agent's re-sends land in different ones.
  const conversationPlan = latestPlan(messages);
  const liveHasPlan = !!streaming && hasPlan(streaming.parts, streaming.tool_events);
  const planOwnerId = liveHasPlan ? null : (conversationPlan?.messageId ?? null);

  const composerRef = useRef<HTMLDivElement>(null);
  const composerInView = useInView(composerRef, { margin: "200px" });

  // Append newly-final voice transcript chunks to the textarea. We only
  // react to the *final* transcript; interim chunks are ephemeral.
  useEffect(() => {
    if (!voice.finalTranscript) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.value =
      (ta.value ? ta.value.trimEnd() + " " : "") + voice.finalTranscript.trim();
  }, [voice.finalTranscript]);

  // Global keyboard shortcuts for power users. All scoped to the
  // In-conversation search bar visibility. Toggled via Cmd/Ctrl+F.
  // Stays on this component (not lifted) because it's purely a view
  // concern — search query only filters the rendered transcript and
  // never round-trips to the server.
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const findInputRef = useRef<HTMLInputElement>(null);

  // /ai page — listeners tear down when this component unmounts, so
  // they don't leak into other routes.
  //
  //   Cmd/Ctrl + K         focus the chat input
  //   Cmd/Ctrl + F         open in-conversation search
  //   Cmd/Ctrl + Shift + N start a fresh conversation (reset)
  //   Escape (when search)  close search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && findOpen) {
        setFindOpen(false);
        setFindQuery("");
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        textareaRef.current?.focus();
      } else if (key === "f" && !e.shiftKey) {
        // Skip when there's no transcript — Ctrl+F should fall through
        // to the browser's native find on the empty state.
        if (messages.length === 0) return;
        e.preventDefault();
        setFindOpen(true);
        // RAF so the input renders before we focus.
        requestAnimationFrame(() => findInputRef.current?.focus());
      } else if (key === "n" && e.shiftKey) {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset, findOpen, messages.length]);

  // Pre-compute a Set of matching message ids so MessageBubble can
  // dim non-matches instead of removing them — keeps the conversation
  // structure (and tool cards) intact while the eye finds the hits.
  // Also keep an ORDERED list of match ids so next/prev stepping has
  // deterministic ordering.
  const { findMatches, findMatchOrder } = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q) return { findMatches: null, findMatchOrder: [] as string[] };
    const set = new Set<string>();
    const order: string[] = [];
    for (const m of messages) {
      // Hidden auto-resume turns aren't rendered, so they can't be a match.
      if (m.role === "user" && isResumeTurn(m.content)) continue;
      if (m.content.toLowerCase().includes(q)) {
        set.add(m.id);
        order.push(m.id);
      }
    }
    return { findMatches: set, findMatchOrder: order };
  }, [findQuery, messages]);

  // Currently-focused match — the row that gets the brighter highlight and
  // gets scrolled into view. Reset to 0 whenever the query changes (new query
  // → start at first match). Adjusted during render (React's documented
  // "reset state when a value changes" pattern) rather than in an effect.
  const [findCursor, setFindCursor] = useState(0);
  const [findCursorQuery, setFindCursorQuery] = useState(findQuery);
  if (findQuery !== findCursorQuery) {
    setFindCursorQuery(findQuery);
    setFindCursor(0);
  }

  // When the cursor moves (or matches change), scroll the focused
  // bubble into view. Tracked by attaching id-keyed refs to each
  // MessageBubble wrapper.
  const findRowRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    const id = findMatchOrder[findCursor];
    if (!id) return;
    findRowRefs.current
      .get(id)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [findCursor, findMatchOrder]);

  const stepFind = (delta: 1 | -1) => {
    if (findMatchOrder.length === 0) return;
    setFindCursor((i) => {
      const next = (i + delta + findMatchOrder.length) % findMatchOrder.length;
      return next;
    });
  };

  const handleToggleMic = () => {
    if (voice.listening) voice.stop();
    else voice.start(isAr ? "ar-SA" : "en-US");
  };

  // @-mention picker (hierarchical categories → entities, chip model). All
  // behaviour lives in the shared hook; this composer uses an *uncontrolled*
  // textarea, so getValue/setValue read/write the DOM node directly.
  const mention = useMentionComposer({
    textareaRef,
    locale: isAr ? "ar" : "en",
    getValue: () => textareaRef.current?.value ?? "",
    setValue: (next) => {
      if (textareaRef.current) textareaRef.current.value = next;
    },
  });

  const handleExport = () => {
    if (messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    // The same derivation the sidebar uses. Slicing the raw message here put
    // the `[Referenced: …]` tail and inline `@` tokens into the exported H1,
    // so one thread came out with two different names.
    const title = conversationTitleFrom(firstUser?.content ?? "");
    const md = conversationToMarkdown({ title, messages, t: tExport });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadMarkdown(`sidekick-${stamp}.md`, md);
  };

  // Drag-and-drop support. We track the "in-progress drag" at the
  // container level so the paperclip button and the drop zone don't
  // flicker against each other. Counter pattern avoids the dragleave
  // bug where moving over a child fires a false "left" event.
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const processImageFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const uploaded = await upload(file);
        if (uploaded) setAttachments((prev) => [...prev, uploaded]);
      }
    },
    [upload],
  );

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current++;
    if (dragDepthRef.current === 1) setIsDragging(true);
  };
  const handleDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      void processImageFiles(e.dataTransfer.files);
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Snapshot into an array BEFORE clearing the input value — `e.target.files`
    // is a live FileList tied to the input, so resetting `value` first empties
    // it and the upload loop would see zero files.
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length) await processImageFiles(files);
  };

  const removeAttachment = (url: string) =>
    setAttachments((prev) => prev.filter((a) => a.url !== url));

  const handleSend = () => {
    const text = textareaRef.current?.value ?? "";
    const hasText = text.trim().length > 0;
    const hasAttachments = attachments.length > 0;
    const hasMentions = mention.picked.length > 0;
    if (!hasText && !hasAttachments && !hasMentions) return;
    if (sending || uploadInProgress) return;

    // Serialize attachments into a machine-readable tag the agent
    // understands (matches ATTACHMENTS_TAG_RE + the prompt contract). The tag
    // is kept for the LLM's context and for reload display; the images
    // themselves are added to products via the structured `attachments`
    // channel below (deterministic — no reliance on the LLM copying URLs).
    const urls = attachments.map((a) => a.url);
    const attachTag =
      urls.length > 0 ? `\n\n[Attached images: ${urls.join(", ")}]` : "";
    const outgoingAttachments = attachments.map((a) => ({
      url: a.url,
      thumbnail: a.thumbnail,
    }));

    // Serialize the picked @-mention chips onto the message tail so the LLM
    // can resolve each entity by id and skip a redundant search call. The
    // block is stripped from the bubble on display (see parseMessageContent).
    const messageForAgent = `${text.trim()}${mention.serialize()}${attachTag}`;

    if (textareaRef.current) textareaRef.current.value = "";
    setAttachments([]);
    mention.reset();
    void send(
      messageForAgent,
      outgoingAttachments.length ? outgoingAttachments : undefined,
    );
  };

  const welcomeName = vendorName?.trim();
  const welcomeTitle = welcomeName
    ? t("page.welcome", { name: welcomeName })
    : t("page.welcomeAnonymous");

  return (
    <div
      // `svh` (small viewport height) tracks the stable visible area on
      // mobile — unlike `vh` which counts the URL bar's hidden size and
      // cuts off the bottom when it retracts. Subtracted offset is
      // smaller on mobile because the dashboard header is shorter.
      className="relative flex flex-col h-[calc(100svh-6rem)] md:h-[calc(100svh-8rem)] max-w-3xl mx-auto w-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-30 rounded-xl border-2 border-dashed border-primary bg-primary/5 flex items-center justify-center pointer-events-none">
          <div className="bg-background border rounded-lg px-4 py-3 shadow-sm text-center">
            <ImageIcon className="size-6 mx-auto mb-1 text-primary" />
            <div className="text-sm font-medium">{t("page.dropImages")}</div>
            <div className="text-xs text-muted-foreground">
              {t("page.dropImagesHint")}
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3 mb-3 md:mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <SparklesIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Sidekick</div>
            {/* Subtitle is marketing fluff; reclaim the row on phones
                so the action buttons to the right stay reachable. */}
            <div className="hidden sm:block text-xs text-muted-foreground truncate">
              {t("page.subtitle")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ConversationsSidebar
            activeId={conversationId}
            locale={isAr ? "ar" : "en"}
            onSwitch={(id) => void switchConversation(id)}
            onNewChat={reset}
          />
          {messages.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                aria-label={t("page.export")}
                className="text-muted-foreground"
              >
                <DownloadIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                aria-label={t("conversations.newChat")}
                className="text-muted-foreground"
              >
                <Trash2Icon className="size-4 sm:me-1" />
                {/* Hide label on phones — icon + tooltip is clearer. */}
                <span className="hidden sm:inline">{t("page.newShort")}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* In-conversation find bar — toggled with Cmd/Ctrl+F. Matching
          messages stay highlighted; non-matches dim. ↑/↓ step through
          matches; Enter advances, Shift+Enter goes back. */}
      {findOpen && (
        <div
          dir={isAr ? "rtl" : "ltr"}
          className="border rounded-lg bg-card p-2 mb-2 flex items-center gap-2 text-sm"
        >
          <input
            ref={findInputRef}
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                stepFind(e.shiftKey ? -1 : 1);
              }
            }}
            placeholder={t("page.findPlaceholder")}
            className="flex-1 bg-transparent border-0 focus:outline-none text-sm"
          />
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {findQuery.trim()
              ? findMatchOrder.length > 0
                ? `${findCursor + 1}/${findMatchOrder.length}`
                : "0"
              : ""}
          </span>
          <button
            type="button"
            onClick={() => stepFind(-1)}
            disabled={findMatchOrder.length === 0}
            aria-label={t("page.findPrevious")}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUpIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => stepFind(1)}
            disabled={findMatchOrder.length === 0}
            aria-label={t("page.findNext")}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDownIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFindOpen(false);
              setFindQuery("");
            }}
            aria-label={t("close")}
            className="p-1 rounded hover:bg-muted"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      )}

      {/* Transcript */}
      <Transcript
        resetKey={conversationId ?? "new"}
        busy={sending}
        label={t("transcript")}
        jumpLabel={t("jumpToLatest")}
        dir={isAr ? "rtl" : "ltr"}
        contentClassName="pe-2 pb-4"
      >
        {loadingHistory && (
          <TranscriptItem>
            <div
              className="flex items-center justify-center py-8"
              role="status"
              aria-live="polite"
            >
              <ShiningText
                className="text-sm"
                text={t("loadingConversation")}
              />
            </div>
          </TranscriptItem>
        )}

        {messages.length === 0 && !sending && !loadingHistory && (
          <TranscriptItem className="flex-1">
          <div className="flex h-full flex-col items-center justify-center gap-4 px-2 py-6 text-center md:gap-6 md:py-8">
            <div className="size-14 md:size-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
              <SiriOrb size="32px" animationDuration={20} />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <h2 className="text-xl md:text-2xl font-semibold">
                {welcomeTitle}
              </h2>
              <p className="text-muted-foreground text-xs md:text-sm max-w-sm">
                {t("page.welcomeBody")}
              </p>
            </div>

            {/* Live shop snapshot — renders only when the briefing query
                returns data, fails silently so the prompt grid below
                remains the stable fallback. */}
            <DailyBriefingCard
              locale={isAr ? "ar" : "en"}
              vendorName={vendorName}
              currency={currency}
              onSuggest={(prompt) => void send(prompt)}
            />

            {/* 7-day rolling snapshot — gives the vendor longer-horizon
                context next to the today-only briefing. Hidden on
                brand-new shops (zero/zero) so it doesn't dominate. */}
            <WeeklyInsightsCard
              locale={isAr ? "ar" : "en"}
              currency={currency}
              onSuggest={(prompt) => void send(prompt)}
            />

            <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-3 gap-3">
              {PROMPT_CATEGORIES.map((cat) => (
                <div
                  key={cat.key}
                  className="border rounded-xl p-3 bg-card text-start space-y-2"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <span className="text-base">{cat.icon}</span>
                    <span>{t(`page.categories.${cat.key}`)}</span>
                  </div>
                  <div className="space-y-1">
                    {cat.prompts[lang].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void send(prompt)}
                        className="block w-full text-start text-[11px] px-2 py-1.5 rounded hover:bg-muted transition"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </TranscriptItem>
        )}

        {messages.map((m, idx) => {
          // Auto-resume turns are sent by the UI on the vendor's behalf after
          // a form save — they drive the next agent run but were never typed,
          // so they never render as a user bubble.
          if (m.role === "user" && isResumeTurn(m.content)) return null;
          const isLastAssistant =
            idx === messages.length - 1 && m.role === "assistant";
          const showFollowUps = isLastAssistant && !streaming && !sending;
          const followUps = showFollowUps
            ? suggestFollowUps(m, isAr ? "ar" : "en")
            : [];
          // When find is active and this message doesn't match the
          // query, fade it out so non-matches recede visually but
          // remain in the scroll flow (so context around hits is
          // preserved). null findMatches means find is closed.
          const dimmed = findMatches !== null && !findMatches.has(m.id);
          // The currently-focused match gets a subtle ring so the
          // vendor knows which hit Enter/↓ stepped to.
          const isFocusedMatch =
            findMatches !== null && m.id === findMatchOrder[findCursor];
          return (
            <TranscriptItem
              key={m.id}
              messageId={m.id}
              // The vendor's own message starts the turn, so it is the row
              // the viewport anchors near the top with the previous turn
              // peeking above it.
              scrollAnchor={m.role === "user"}
              ref={(el) => {
                if (el) findRowRefs.current.set(m.id, el);
                else findRowRefs.current.delete(m.id);
              }}
              className={cn(
                "space-y-2 rounded-lg transition-opacity",
                dimmed && "opacity-30",
                isFocusedMatch &&
                  "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-background",
              )}
            >
              <MessageBubble
                message={m}
                currency={currency}
                locale={isAr ? "ar" : "en"}
                highlightQuery={findQuery}
                // Only the latest assistant turn gets the regen button.
                // Showing it on older turns would be confusing because
                // regenerate always rewinds to the LAST user prompt.
                canRegenerate={showFollowUps}
                onRegenerate={regenerate}
                // Live buttons only on the turn the server is actually
                // parked on. Every other approval card in the transcript is
                // a record of a decision already made.
                onApprovalDecide={
                  pendingApproval && m.id === messages.at(-1)?.id
                    ? resolveApproval
                    : undefined
                }
                approvalBusy={sending}
                // A turn that died mid-flight offers a retry, but only while
                // it is the last one — regenerate rewinds to the last prompt.
                onRetry={m.id === messages.at(-1)?.id ? regenerate : undefined}
                retrying={sending}
                onSuggest={(text) => void send(text)}
                planIsCurrent={m.id === planOwnerId}
              />
              {followUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ps-1">
                  {followUps.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void send(prompt)}
                      className="text-[11px] px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </TranscriptItem>
          );
        })}

        {streaming && (
          <TranscriptItem messageId="streaming">
            <StreamingBubble
              parts={streaming.parts}
              text={streaming.text}
              toolEvents={streaming.tool_events}
              currency={currency}
              locale={isAr ? "ar" : "en"}
            />
          </TranscriptItem>
        )}

        {sending && !streaming?.text && streaming?.tool_events.length === 0 && (
          <TranscriptItem messageId="thinking">
            <div
              className="flex items-center gap-2 px-4"
              role="status"
              aria-live="polite"
            >
              <AgentOrb />
              <ShiningText className="text-sm" text={t("page.thinking")} />
            </div>
          </TranscriptItem>
        )}

        {error && (
          <TranscriptItem messageId="stream-error">
            <div
              role="alert"
              dir="auto"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm break-words text-destructive"
            >
              {error}
            </div>
          </TranscriptItem>
        )}

        {/* Quick actions ride INSIDE the log. Mounted between the transcript
            and the composer they changed the viewport height at the start and
            end of every turn, moving the reader for no reason. In the empty
            state the categorized prompt grid already covers this ground. */}
        {messages.length > 0 && !sending && !streaming && (
          <TranscriptItem messageId="quick-actions">
            <div
              className="flex flex-wrap gap-1.5 pt-1"
              dir={isAr ? "rtl" : "ltr"}
            >
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => void send(action.prompt[lang])}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] transition hover:bg-muted"
                >
                  <span>{action.icon}</span>
                  <span>{t(`page.quickActions.${action.key}`)}</span>
                </button>
              ))}
            </div>
          </TranscriptItem>
        )}
      </Transcript>

      {/* Pinned above the composer, outside the scroller — see the panel for
          why this one is allowed to resize the viewport when the error banner
          was not: it appears once per plan, not mid-read. */}
      {conversationPlan && (
        <TaskPlanStrip
          steps={conversationPlan.steps}
          running={!!streaming}
          className="mb-2"
        />
      )}

      {/* Input — glass pill set inside an animated NoiseBackground gradient frame. */}
      <div
        ref={composerRef}
        className="relative"
        style={{ perspective: 1200 }}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* @-mention picker — a popup floating ABOVE the whole composer
            (anchored to this relative wrapper), not nested inside the input
            pill. Root lists categories; drilling in shows entity results. */}
        {mention.open && (
          <div className="absolute inset-x-0 bottom-full z-50 mb-2">
            <MentionDropdown
              category={mention.category}
              candidates={mention.candidates}
              activeIndex={mention.activeIndex}
              loading={mention.loading}
              locale={isAr ? "ar" : "en"}
              onPickCategory={mention.pickCategory}
              onPickCandidate={mention.pickCandidate}
              onBack={mention.goBack}
              onHover={mention.setActiveIndex}
            />
          </div>
        )}
        <NoiseBackground
          gradientColors={COMPOSER_GRADIENT_COLORS}
          noiseIntensity={0.15}
          speed={0.06}
          animating={composerInView && !prefersReducedMotion}
          containerClassName="rounded-[1.75rem] p-1.5"
        >
        <motion.div
          initial={
            prefersReducedMotion ? false : { rotateX: 12, y: 8, opacity: 0 }
          }
          animate={{ rotateX: 0, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          style={{
            transformPerspective: 1200,
            transformOrigin: "center bottom",
          }}
          className="rounded-[1.5rem] border border-border/60 bg-background/85 p-3 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)]"
        >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {attachments.map((a) => (
              <div
                key={a.url}
                className="group relative size-16 rounded-lg overflow-hidden border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.thumbnail}
                  alt={a.name}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(a.url)}
                  aria-label={t("composer.remove")}
                  className="absolute top-0.5 end-0.5 size-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
            {uploadInProgress && (
              <div className="size-16 rounded-lg border bg-muted animate-pulse flex items-center justify-center">
                <ImageIcon className="size-5 text-muted-foreground/50" />
              </div>
            )}
          </div>
        )}

        {/* Picked @-mention chips — persistent entity references that ride
            with the next message, shown inside the pill above the textarea.
            (The picker itself floats above the whole composer — see below.) */}
        {mention.picked.length > 0 && (
          <div className="pb-2">
            <MentionChips
              mentions={mention.picked}
              onRemove={mention.removeMention}
            />
          </div>
        )}

        <Textarea
          ref={textareaRef}
          rows={2}
          placeholder={t("page.inputPlaceholder")}
          disabled={sending}
          onChange={(e) =>
            mention.onValueChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
            )
          }
          onKeyDown={(e) => {
            // The mention picker owns the keyboard while open (arrows / Enter /
            // Tab / Escape / Backspace-to-go-back); it returns true when it
            // consumed the key, so we skip the textarea's Enter = send.
            if (mention.onKeyDown(e)) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="border-0 focus-visible:ring-0 resize-none shadow-none min-h-[2.5rem]"
        />

        {uploadError && (
          <div className="text-[10px] text-destructive pt-1">{uploadError}</div>
        )}

        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              type="button"
              onClick={handlePickFile}
              disabled={sending || uploadInProgress}
              aria-label={t("composer.attachImage")}
              className="rounded-full size-9"
            >
              <PaperclipIcon className="size-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilesPicked}
            />
            {voice.supported && (
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={handleToggleMic}
                disabled={sending}
                aria-label={
                  voice.listening
                    ? t("composer.stopRecording")
                    : t("composer.voiceInput")
                }
                className={cn(
                  "rounded-full size-9",
                  voice.listening &&
                    "bg-red-500/10 text-red-600 hover:bg-red-500/20",
                )}
              >
                {voice.listening ? (
                  <MicOffIcon className="size-4" />
                ) : (
                  <MicIcon className="size-4" />
                )}
              </Button>
            )}
            {voice.listening && (
              // Transcript text eats horizontal space on narrow
              // screens — the red pulsing mic icon is already a clear
              // indicator, so hide the label below sm.
              <span className="hidden sm:inline text-[10px] text-red-600 animate-pulse truncate max-w-[140px]">
                {voice.interimTranscript
                  ? `"${voice.interimTranscript}"`
                  : t("composer.listening")}
              </span>
            )}
          </div>
          <Button
            size="icon"
            onClick={sending ? stop : handleSend}
            disabled={uploadInProgress}
            aria-label={sending ? t("composer.stop") : t("send")}
            className="rounded-full size-9 overflow-hidden"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={sending ? "stop" : "send"}
                initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="grid place-items-center"
              >
                {sending ? (
                  <StopCircleIcon className="size-4" />
                ) : (
                  <ArrowUpIcon className="size-4" />
                )}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
        </motion.div>
        </NoiseBackground>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  currency,
  locale,
  highlightQuery = "",
  canRegenerate = false,
  onRegenerate,
  onApprovalDecide,
  approvalBusy = false,
  onRetry,
  retrying = false,
  onSuggest,
  planIsCurrent = true,
}: {
  message: VendorAgentMessage;
  /** True only on the turn holding the conversation's newest plan snapshot. */
  planIsCurrent?: boolean;
  currency: string;
  locale: "ar" | "en";
  /** When non-empty, matching substrings inside the bubble text get
   *  wrapped in <mark>. Used by the in-conversation find bar. */
  highlightQuery?: string;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  /** Passed only to the turn whose approval is genuinely still pending on
   *  the server, so older approval cards render as read-only history. */
  onApprovalDecide?: (decisions: AgentApprovalDecision[]) => void;
  approvalBusy?: boolean;
  /** Retry for a turn that died mid-flight. Passed only to the last turn. */
  onRetry?: () => void;
  retrying?: boolean;
  /** Lets a result card send a message instead of making the vendor retype
   *  a choice it already listed. */
  onSuggest?: (text: string) => void;
}) {
  const t = useTranslations("aiChat.composer");
  const isUser = message.role === "user";
  // User messages embed `[Attached images: ...]` and `[Referenced: ...]`
  // tags at the tail so the LLM can read them. We strip both before
  // rendering and surface images as thumbnails + mentions as pills, so the
  // vendor sees a clean bubble.
  const { text, images, mentions } = isUser
    ? parseMessageContent(message.content)
    : {
        text: message.content,
        images: [] as string[],
        mentions: [] as Array<{ type: MentionType; display: string }>,
      };
  const { pills } = splitBubbleMentions(text, mentions);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] sm:max-w-[85%] space-y-2 text-end">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {images.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="size-20 rounded-lg object-cover border"
                />
              ))}
            </div>
          )}
          {text && (
            <div
              dir="auto"
              className="inline-block rounded-2xl bg-primary px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-primary-foreground [overflow-wrap:anywhere]"
            >
              {highlight(text, highlightQuery)}
            </div>
          )}
          {/* Pills only for mentions that are NOT already sitting in the text.
              This composer always lifts them out, so for anything typed here
              that is all of them — but the slide-in panel writes them inline
              and both surfaces restore the SAME conversation from
              `vendor_agent_conv:{shopSlug}`, so a message composed in the
              panel arrives here carrying its tokens. Without the split, that
              message shows every mention twice. */}
          {pills.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {pills.map((m, i) => {
                const def = categoryDef(m.type);
                return (
                  <span
                    key={`${m.type}:${m.display}:${i}`}
                    className="inline-flex items-center gap-1 max-w-45 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] text-foreground"
                  >
                    <def.Icon className={cn("size-3 shrink-0", def.color)} />
                    <span className="truncate">{m.display}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant turn: rendered as an interleaved work log. Copy / regenerate
  // controls sit under the turn and surface on hover.
  return (
    <div className="flex justify-start">
      <div className="group/turn max-w-[90%] sm:max-w-[85%]">
        <AssistantTurn
          parts={message.parts}
          content={text}
          toolEvents={message.tool_events}
          currency={currency}
          locale={locale}
          highlightQuery={highlightQuery}
          onApprovalDecide={onApprovalDecide}
          approvalBusy={approvalBusy}
          onRetry={onRetry}
          retrying={retrying}
          onSuggest={onSuggest}
          planIsCurrent={planIsCurrent}
        />
        {text && (
          <div className="flex gap-1 ps-1 pt-1 opacity-0 group-hover/turn:opacity-100 focus-within:opacity-100 transition">
            <CopyButton text={text} />
            {canRegenerate && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                aria-label={t("regenerate")}
                className="p-1 rounded bg-background border shadow-sm hover:bg-muted transition"
              >
                <RefreshCwIcon className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the in-progress assistant turn as events arrive: the typing
 * text bubble on top, any tool cards below it. Marked with a blinking
 * caret so the vendor can see the generation is live.
 */
function StreamingBubble({
  parts,
  text,
  toolEvents,
  currency,
  locale,
}: {
  parts: AssistantPart[];
  text: string;
  toolEvents: VendorAgentToolEvent[];
  currency: string;
  locale: "ar" | "en";
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] sm:max-w-[85%]">
        <AssistantTurn
          parts={parts}
          content={text}
          toolEvents={toolEvents}
          currency={currency}
          locale={locale}
          caret
        />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("aiChat.composer");
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t("copy")}
      className="p-1 rounded bg-background border shadow-sm hover:bg-muted transition"
    >
      {copied ? (
        <CheckIcon className="size-3 text-emerald-600" />
      ) : (
        <CopyIcon className="size-3" />
      )}
    </button>
  );
}
