"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowUpIcon,
  AtSignIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CrosshairIcon,
  EyeIcon,
  FileIcon,
  ImageIcon,
  InfoIcon,
  LayoutGridIcon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MinimizeIcon,
  PlusIcon,
  StopCircleIcon,
  UploadIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { isOverlayRoute } from "@/shared/lib/overlay-routes";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  useChatUpload,
  type UploadedAttachment,
} from "@/features/ai/lib/use-chat-upload";
import SiriOrb from "@/components/smoothui/siri-orb";
import { COMPOSER_GRADIENT_COLORS } from "@/features/ai/lib/composer-halo";
import { NoiseBackground } from "@repo/ui/components/noise-background";
import { ShiningText } from "@repo/ui/components/shining-text";
import { useAiChatStore } from "@/features/ai/store-chat";
import { useShopCurrency } from "@/shared/hooks/use-shop-currency";
import { useActiveShopStore } from "@/shared/stores/active-shop";
import { useVendorAgent } from "@/features/ai/lib/use-vendor-agent";
import { useVoiceInput } from "@/features/ai/lib/use-voice-input";
import { useInlineMentionComposer } from "@/features/ai/lib/use-inline-mention-composer";
import { hasPlan, latestPlan } from "@/features/ai/lib/task-plan";
import { TaskPlanStrip } from "@/features/ai/components/task-plan-strip";
import { splitBubbleMentions } from "@/features/ai/lib/inline-mentions";
import {
  mentionCategory as categoryDef,
  parseMentionTag,
  type MentionType,
} from "@/features/ai/lib/mention-config";
import { InlineMentionMenu } from "@/features/ai/components/inline-mention-menu";
import { MentionTextarea } from "@/features/ai/components/mention-textarea";
import { LiveFormChip } from "@/features/ai/components/live-form-chip";
import { useLiveFormChip } from "@/features/ai/lib/live-form";
import type {
  AgentApprovalDecision,
  AssistantPart,
  VendorAgentMessage,
  VendorAgentToolEvent,
} from "@/features/ai/lib/types";
import { AssistantTurn } from "@/features/ai/components/assistant-turn";
import {
  Transcript,
  TranscriptItem,
} from "@/features/ai/components/transcript";
import { ConversationSearchDialog } from "@/features/ai/components/conversation-search-dialog";
import { isResumeTurn } from "@/features/ai/lib/resume-marker";
import { useHydrated, useSafeReducedMotion } from "@repo/ui/hooks/use-hydrated";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 340;
const MAX_WIDTH_OFFSET = 400; // leave at least this much for the rest of the page

/**
 * Settings is an overlay, and the panel has to climb over it.
 *
 * `/store/<slug>/settings/**` renders `SettingsShell`, a `fixed … z-40` sheet
 * above the whole dashboard. The panel is normally an `absolute` child of the
 * content column, and raising its `z-index` alone does nothing about that:
 * `z-index` only ranks siblings inside a stacking context, and an absolute
 * child of the column cannot paint over a fixed element mounted outside it
 * whatever number it carries. So while a settings URL is on screen the panel
 * goes `fixed` too — and only then, because sitting in flow beside the content
 * is the whole point of it everywhere else.
 *
 * Read off the path rather than a flag the shell raises on mount, for the
 * reason `parseSettingsPath` gives: a second copy of "where am I" is a second
 * thing that can lag a navigation, and a flag written in an effect would leave
 * the panel one commit behind the sheet it exists to clear.
 */
// Which paths are sheets is decided once, in `shared/lib/overlay-routes`: the
// store-import review is drawn the same way, and `DashboardShell` reads the
// same rule to make the covered sidebar inert.

function useGreeting(name?: string) {
  const t = useTranslations("aiChat.greeting");
  const hydrated = useHydrated();
  // Time-of-day uses the client's timezone, so compute it only after hydration
  // — otherwise the SSR hour and client hour can disagree (hydration mismatch).
  const hour = hydrated ? new Date().getHours() : -1;
  if (hour < 0) return name ?? "";
  const prefix =
    hour < 5
      ? t("night")
      : hour < 12
        ? t("morning")
        : hour < 18
          ? t("afternoon")
          : t("evening");
  return name ? t("withName", { greeting: prefix, name }) : prefix;
}

/**
 * Width-resize hook driven by a pointer-down on the panel's start
 * edge. Returns the current width plus a `onPointerDown` to attach
 * to the drag handle. Native pointer events instead of a library —
 * three callbacks, no measurement timing surprises, no remounts.
 */
function useDragWidth(initial: number) {
  const [width, setWidth] = useState(initial);
  // `dragging` (state) lets the panel switch to an instant width transition
  // while the user drags the handle, so the resize tracks the cursor 1:1
  // instead of lagging behind the open/close spring.
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      setDragging(true);
      const startX = e.clientX;
      const startWidth = width;

      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return;
        // The panel sits at the trailing edge of the layout (LTR: right;
        // RTL: left). Dragging the handle "outward" (toward the page
        // start) grows the panel. We compute deltaX from the page-start
        // pointer movement and read the document direction once at
        // drag-start so we don't fight the locale switch mid-drag.
        const dir = document.documentElement.dir === "rtl" ? -1 : 1;
        const deltaX = (startX - ev.clientX) * dir;
        const next = Math.min(
          Math.max(startWidth + deltaX, MIN_WIDTH),
          Math.max(MIN_WIDTH, window.innerWidth - MAX_WIDTH_OFFSET),
        );
        setWidth(next);
      };
      const onUp = () => {
        draggingRef.current = false;
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  return { width, setWidth, onPointerDown, dragging };
}

export function AiChatPanel({ userName }: { userName?: string }) {
  const t = useTranslations("aiChat");
  const locale = useLocale();
  const isAr = locale === "ar";
  const pathname = usePathname();
  const overSettings = isOverlayRoute(pathname);
  const isMobile = useIsMobile();

  const open = useAiChatStore((s) => s.open);
  const expanded = useAiChatStore((s) => s.expanded);
  const closePanel = useAiChatStore((s) => s.closePanel);
  const toggleExpanded = useAiChatStore((s) => s.toggleExpanded);
  const pendingPrompt = useAiChatStore((s) => s.pendingPrompt);
  const clearPendingPrompt = useAiChatStore((s) => s.clearPendingPrompt);
  const pendingReceipt = useAiChatStore((s) => s.pendingReceipt);
  const clearPendingReceipt = useAiChatStore((s) => s.clearPendingReceipt);

  const {
    messages,
    appendMessage,
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
  // The product form the assistant prepared, while it is on screen: the next
  // message carries its values, and the chip in the composer says so.
  const liveForm = useLiveFormChip();

  const [draft, setDraft] = useState("");
  // Command-palette popup (Shopify-style) opened from the header title —
  // search past conversations or start a new one.
  const [searchOpen, setSearchOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const greeting = useGreeting(userName);
  // Cards used to format every amount as USD here, whatever the shop
  // actually trades in.
  const currency = useShopCurrency();
  // The one turn failure the vendor can act on is their own plan
  // allowance running out, so the error card is handed somewhere to send
  // them. Undefined before a shop is resolved, and the card just omits the
  // button.
  const activeShopSlug = useActiveShopStore((s) => s.slug);
  const planHref = activeShopSlug
    ? `/store/${activeShopSlug}/settings/plan`
    : undefined;
  const hasMessages = messages.length > 0;

  const prefersReducedMotion = useSafeReducedMotion();
  // Halo wrapper ref — pauses the WebGL render loop when off-screen.
  // Which turn owns the "To-dos" card, and what the pinned strip says.
  //
  // A turn can only see its own `parts`, and the prescribed multi-step flow
  // (hand off to a form, vendor saves, chat auto-resumes) guarantees the
  // agent's re-sends land in DIFFERENT turns — so leaving the choice to each
  // turn produced one frozen card per turn, stacked down the log. The live
  // turn wins while it is producing a snapshot of its own; otherwise the
  // newest committed one does.
  const conversationPlan = latestPlan(messages);
  const liveHasPlan = !!streaming && hasPlan(streaming.parts, streaming.tool_events);
  const planOwnerId = liveHasPlan ? null : (conversationPlan?.messageId ?? null);

  const composerRef = useRef<HTMLDivElement>(null);
  const composerInView = useInView(composerRef, { margin: "200px" });

  const voice = useVoiceInput();
  // Draft text present before dictation began — the transcript is appended onto it.
  const voiceBaseRef = useRef("");

  // @-mention picker. The panel uses the *inline* model — a picked entity
  // stays in the draft as `@Display` and is painted by a mirrored backdrop —
  // so it binds its own hook rather than the chip-model one the full-page chat
  // still runs on. `composerRef` doubles as the picker's containing block:
  // the popup is placed from a measured caret offset inside it.
  const mention = useInlineMentionComposer({
    textareaRef,
    anchorRef: composerRef,
    locale: isAr ? "ar" : "en",
    value: draft,
    setValue: setDraft,
  });

  // Image attachments — the "+" menu's "Upload from device" opens the picker;
  // uploaded files ride with the next message as an [Attached images: ...] tag
  // the agent understands (same pipeline as the full-page /ai composer).
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    upload,
    uploading: uploadInProgress,
    error: uploadError,
  } = useChatUpload();

  // Docked width (340 / dragged). The drag handle resizes it; it persists
  // across expand so collapsing returns to the same docked size.
  const { width, setWidth, onPointerDown, dragging } = useDragWidth(DEFAULT_WIDTH);

  // When expanded, the overlay grows to fill the whole area right of the
  // sidebar. Measure that area (the panel's flex parent). The push spacer
  // stays at the docked width, so the page content keeps its layout —
  // expanding/collapsing the overlay never reflows the page.
  const [fullWidth, setFullWidth] = useState(0);
  useEffect(() => {
    if (!expanded) return;
    const parent = asideRef.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => setFullWidth(parent.clientWidth));
    observer.observe(parent);
    return () => observer.disconnect();
  }, [expanded]);

  // Docked: a flex spacer reserves this width (pushes the content) and the
  // absolute panel sits exactly over it. Expanded: the panel grows OVER the
  // content while the spacer stays put.
  const dockedWidth = open && !isMobile ? width : 0;
  const panelWidth = open
    ? isMobile
      ? "100%"
      : expanded
        ? fullWidth || width
        : width
    : 0;

  // Keyboard resize for the drag handle: arrows nudge the width (RTL-aware),
  // Home/End jump to the min/max. Mirrors the pointer clamp.
  const resizeMax = () =>
    typeof window === "undefined"
      ? MIN_WIDTH
      : Math.max(MIN_WIDTH, window.innerWidth - MAX_WIDTH_OFFSET);
  const handleResizeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const grow =
      (e.key === "ArrowLeft" && !isAr) || (e.key === "ArrowRight" && isAr);
    const shrink =
      (e.key === "ArrowRight" && !isAr) || (e.key === "ArrowLeft" && isAr);
    let next: number;
    if (grow) next = width + 24;
    else if (shrink) next = width - 24;
    else if (e.key === "Home") next = MIN_WIDTH;
    else if (e.key === "End") next = resizeMax();
    else return;
    e.preventDefault();
    setWidth(Math.min(Math.max(next, MIN_WIDTH), resizeMax()));
  };

  // When the panel opens, remember what had focus and move focus into the
  // composer; when it closes, return focus there (usually the header toggle)
  // so keyboard users aren't dropped to <body>.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      const raf = requestAnimationFrame(() => textareaRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    restoreFocusRef.current?.focus?.();
  }, [open]);

  // Escape closes the panel (standard overlay dismissal). Skip if a nested
  // control (popover/dropdown) already handled the key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Escape") return;
      closePanel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  // Auto-send a prompt queued from outside the panel (e.g. typed in the
  // dashboard welcome bar). Consume it once so it can't replay on re-render.
  useEffect(() => {
    if (!open || !pendingPrompt) return;
    const prompt = pendingPrompt;
    clearPendingPrompt();
    void send(prompt);
  }, [open, pendingPrompt, clearPendingPrompt, send]);

  // A receipt the server wrote when the vendor saved something the agent
  // prepared. Appended rather than streamed — there is no turn behind it —
  // and only into the thread it belongs to, since the panel may be sitting on
  // a different conversation by now. Consumed once, like pendingPrompt.
  useEffect(() => {
    if (!pendingReceipt) return;
    if (pendingReceipt.conversationId !== conversationId) return;
    const { message } = pendingReceipt;
    clearPendingReceipt();
    appendMessage(message);
  }, [pendingReceipt, conversationId, clearPendingReceipt, appendMessage]);

  // Auto-grow the textarea up to ~5 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Empty draft → keep the single-row height (rows={1}). Measuring
    // scrollHeight while the panel is still closed/zero-width wraps the
    // placeholder and reports a too-tall value, which made a fresh
    // conversation open with a giant input.
    if (!draft) return;
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  // Append the (accumulating) final voice transcript onto whatever text the
  // user had typed before dictation started. Rebuilding from the base each
  // time avoids duplicating chunks as the transcript grows.
  useEffect(() => {
    if (!voice.finalTranscript) return;
    const base = voiceBaseRef.current;
    // Syncing the speech-recognition transcript (an external system) into the
    // controlled draft — the documented exception to set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((base ? base.trimEnd() + " " : "") + voice.finalTranscript.trim());
  }, [voice.finalTranscript]);

  function handleSend() {
    const trimmed = draft.trim();
    const hasAttachments = attachments.length > 0;
    // No separate mention check: an inline mention IS text, so a draft holding
    // nothing but `@Summer Hoodie` is already non-empty. (The chip composer
    // needed one, because a picked chip left the textarea blank.)
    if ((!trimmed && !hasAttachments) || sending || uploadInProgress) return;
    // Serialize attachments into the machine-readable tag the agent reads
    // (matches ATTACHMENTS_TAG_RE + the prompt contract). The tag is kept for
    // the LLM's context + reload display; the images themselves reach
    // create_product/update_product through the structured `attachments`
    // channel below (deterministic — no reliance on the LLM copying URLs).
    const urls = attachments.map((a) => a.url);
    const attachTag =
      urls.length > 0 ? `\n\n[Attached images: ${urls.join(", ")}]` : "";
    const outgoingAttachments = attachments.map((a) => ({
      url: a.url,
      thumbnail: a.thumbnail,
    }));
    const messageForAgent = `${trimmed}${mention.serialize()}${attachTag}`;
    setDraft("");
    setAttachments([]);
    mention.reset();
    void send(
      messageForAgent,
      outgoingAttachments.length ? outgoingAttachments : undefined,
    );
  }

  async function processImageFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const uploaded = await upload(file);
      if (uploaded) setAttachments((prev) => [...prev, uploaded]);
    }
  }

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    // Snapshot the File objects into a real array BEFORE clearing the input's
    // value. `e.target.files` is a live FileList tied to the input, so
    // resetting `value` first empties it and the upload loop would see zero
    // files. File references stay valid once copied out.
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length) await processImageFiles(files);
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // The mention picker owns the keyboard while open; it returns true when it
    // consumed the key, so we skip the textarea's Enter = send.
    if (mention.onKeyDown(event)) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleToggleMic() {
    if (voice.listening) {
      voice.stop();
      return;
    }
    voiceBaseRef.current = draft;
    voice.start(isAr ? "ar-SA" : "en-US");
  }

  return (
    <>
      {/* Push spacer — reserves the docked width so the content shrinks beside
          the panel while docked (the original "push" behaviour). It stays
          reserved even when expanded, so the expand/collapse overlay never
          reflows the page. */}
      <motion.div
        aria-hidden
        className="shrink-0"
        initial={false}
        animate={{ width: dockedWidth }}
        transition={
          dragging || prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.3, ease: "easeOut" }
        }
      />
      <motion.aside
        ref={asideRef}
        id="ai-chat-panel"
        aria-hidden={!open}
        inert={!open}
        aria-label={t("title")}
        initial={false}
        animate={{ width: panelWidth }}
        transition={
          dragging || prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.3, ease: "easeOut" }
        }
        className={cn(
          // Absolute overlay pinned to the trailing edge. Docked: it sits
          // exactly over the spacer (looks docked, beside the content).
          // Expanded: it grows OVER the content (slide-over) — no page reflow.
          // Phone: a sheet, not a 340px push. Pushing leaves ~50px for the form.
          isMobile
            ? "fixed inset-x-0 bottom-0 top-(--header-height) z-45 flex flex-col overflow-hidden bg-card text-foreground"
            : overSettings
              ? "fixed end-0 bottom-0 top-(--header-height) z-45 flex flex-col overflow-hidden bg-card text-foreground"
              : "absolute inset-y-0 end-0 z-20 flex flex-col overflow-hidden bg-card text-foreground",
          open && "border-s border-border shadow-[0_0_24px_-8px_rgba(0,0,0,0.18)]",
          !expanded && !isMobile && "rounded-t-2xl",
        )}
      >
      {/* Drag handle — a thin invisible strip on the panel's start
          edge. Visible only when the panel is open and width > 0. */}
      {open && !expanded && !isMobile && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("resize")}
          aria-valuenow={Math.round(width)}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={resizeMax()}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onKeyDown={handleResizeKey}
          className="absolute inset-y-0 inset-s-0 z-10 w-1 cursor-ew-resize outline-none transition-colors hover:bg-primary/30 focus-visible:bg-primary/40"
        />
      )}

      <div className="flex h-full w-full flex-col">
        {/* Panel header */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-muted"
            onClick={() => setSearchOpen(true)}
            aria-label={t("newConversation")}
          >
            <span>{t("newConversation")}</span>
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label={t("preview")}
              disabled
            >
              <EyeIcon className="size-4" />
            </Button>
            {!isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={toggleExpanded}
              aria-label={expanded ? t("collapse") : t("expand")}
            >
              {expanded ? (
                <MinimizeIcon className="size-4" />
              ) : (
                <MaximizeIcon className="size-4" />
              )}
            </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={closePanel}
              aria-label={t("close")}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Body. The scroller owns following, anchoring and the opening
            position; see components/transcript.tsx for why none of that is
            an effect here any more. Expanded caps the column to a readable
            width — set on the CONTENT, so the scroller measures rows rather
            than padding. */}
        <Transcript
          resetKey={conversationId ?? "new"}
          busy={sending}
          label={t("title")}
          jumpLabel={t("jumpToLatest")}
          dir={isAr ? "rtl" : "ltr"}
          contentClassName={cn(
            "px-4 py-6",
            expanded && "mx-auto w-full max-w-3xl",
          )}
        >
          {loadingHistory && (
            <TranscriptItem>
              <div
                className="flex items-center justify-center py-6"
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

          {!hasMessages && !loadingHistory && !streaming && (
            <TranscriptItem className="flex-1">
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-[90px] w-[90px] items-center justify-center">
                  <SiriOrb size="90px" animationDuration={20} />
                </div>
                <h2 className="mt-5 text-xl font-semibold">{greeting}</h2>
                <p className="mt-1 text-lg text-muted-foreground">
                  {t("howCanIHelp")}
                </p>
              </div>
            </TranscriptItem>
          )}

          {messages.map((m) =>
            // Auto-resume turns drive the next run but were never typed by
            // the vendor, so they never render as a user bubble.
            m.role === "user" && isResumeTurn(m.content) ? null : (
              <TranscriptItem
                key={m.id}
                messageId={m.id}
                // The vendor's own message is what starts a turn, so it is
                // the row the viewport anchors near the top.
                scrollAnchor={m.role === "user"}
              >
                <MessageBubble
                  message={m}
                  currency={currency}
                  locale={isAr ? "ar" : "en"}
                  // Live buttons only on the turn the server is actually
                  // parked on; older approval cards are read-only history.
                  onApprovalDecide={
                    pendingApproval && m.id === messages.at(-1)?.id
                      ? resolveApproval
                      : undefined
                  }
                  approvalBusy={sending}
                  // Retry belongs to the last turn only — regenerate always
                  // rewinds to the last user prompt.
                  onRetry={m.id === messages.at(-1)?.id ? regenerate : undefined}
                  retrying={sending}
                  onSuggest={(text) => void send(text)}
                  planHref={planHref}
                  planIsCurrent={m.id === planOwnerId}
                />
              </TranscriptItem>
            ),
          )}

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

          {/* Inside the log, not in a strip between it and the composer: a
              banner there resized the viewport under the reader and was
              detached from the turn that actually failed. */}
          {error && (
            <TranscriptItem messageId="stream-error">
              <div
                role="alert"
                dir="auto"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs break-words text-destructive"
              >
                {error}
              </div>
            </TranscriptItem>
          )}
        </Transcript>

        {/* Pinned above the composer, outside the scroller, because the whole
            point is that it stays put while the vendor is off saving a form —
            the panel travels with them, the log does not follow. It resizes
            the viewport the way the error banner used to, and gets away with
            it for the reason the banner did not: it appears once when a plan
            starts and goes once it finishes, not in the middle of reading. */}
        {conversationPlan && (
          <div className="px-2 pt-1">
            <TaskPlanStrip
              steps={conversationPlan.steps}
              running={!!streaming}
            />
          </div>
        )}

        {/* Composer — glass pill set inside an animated NoiseBackground gradient frame (matches the full-page chat). */}
        <div className="px-2 pb-4 pt-1">
          <div
            ref={composerRef}
            className="relative"
            style={{ perspective: 1200 }}
          >
            {/* @-mention picker — anchored at the "@" being typed, and a child
                of THIS wrapper rather than of the pill: `NoiseBackground` is
                overflow-hidden and would clip it. */}
            {mention.open && (
              <InlineMentionMenu
                category={mention.category}
                candidates={mention.candidates}
                activeIndex={mention.activeIndex}
                loading={mention.loading}
                failed={mention.failed}
                locale={isAr ? "ar" : "en"}
                anchor={mention.anchor}
                onPickCategory={mention.pickCategory}
                onPickCandidate={mention.pickCandidate}
                onBack={mention.goBack}
                onHover={mention.setActiveIndex}
              />
            )}
            <NoiseBackground
              gradientColors={COMPOSER_GRADIENT_COLORS}
              noiseIntensity={0.15}
              speed={0.06}
              animating={open && composerInView && !prefersReducedMotion}
              containerClassName="rounded-[1.5rem] p-2"
            >
            {/* `compose-root` is what the focus ring below listens to. The ring
                is a conic sweep that only turns while something inside the pill
                has focus; it replaces the pill's old static `focus-within:ring`,
                because two rings at two radii read as a mistake. It sits inside
                the halo's own 8px padding, so nothing clips it. */}
            <div className="compose-root relative isolate">
            <div
              aria-hidden
              className="compose-ring pointer-events-none absolute -inset-[3px] -z-10 rounded-[1.4rem] blur-[2px]"
            />
            <motion.div
              initial={
                prefersReducedMotion ? false : { rotateX: 12, y: 6, opacity: 0 }
              }
              animate={{ rotateX: 0, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
              style={{
                transformPerspective: 1200,
                transformOrigin: "center bottom",
              }}
              className="flex flex-col gap-1.5 rounded-[1.25rem] border border-border/60 bg-card px-2.5 py-2 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)] focus-within:border-ring"
            >
              {/* No mention chips here: a picked entity stays in the draft as
                  a highlighted `@Display` token, so the composer has one place
                  a mention can live rather than two. */}

              {/* The open form rides with the next message too, and the
                  assistant can change it — the chip is what says so. */}
              {liveForm && (
                <LiveFormChip target={liveForm.target} label={liveForm.label} />
              )}

              {/* Image attachment thumbnails — ride with the next message. */}
              {(attachments.length > 0 || uploadInProgress) && (
                <div className="flex flex-wrap gap-1.5 px-0.5">
                  {attachments.map((a) => (
                    <div
                      key={a.url}
                      className="group relative size-12 overflow-hidden rounded-lg border bg-muted"
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
                        className="absolute end-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <XIcon className="size-2.5" />
                      </button>
                    </div>
                  ))}
                  {uploadInProgress && (
                    <div className="flex size-12 animate-pulse items-center justify-center rounded-lg border bg-muted">
                      <ImageIcon className="size-4 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              )}
              {uploadError && (
                <div className="px-0.5 text-[10px] text-destructive">
                  {uploadError}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesPicked}
              />

              <div className="flex items-end gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={(p) => (
                    <Button
                      {...p}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      aria-label={t("attach")}
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                  )}
                />
                <DropdownMenuContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="w-60"
                >
                  <DropdownMenuItem disabled>
                    <FileIcon className="size-4 opacity-70" />
                    <span className="flex-1">{t("panel.menu.files")}</span>
                    <ChevronRightIcon className="size-4 opacity-50 rtl:rotate-180" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePickFile}>
                    <UploadIcon className="size-4 opacity-70" />
                    <span className="flex-1">{t("panel.menu.upload")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <CrosshairIcon className="size-4 opacity-70" />
                    <span className="flex-1">{t("panel.menu.target")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={mention.openAtCaret}>
                    <AtSignIcon className="size-4 opacity-70" />
                    <span className="flex-1">{t("panel.menu.mention")}</span>
                    <kbd className="text-xs text-muted-foreground">@</kbd>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <ZapIcon className="size-4 opacity-70" />
                    <span className="flex-1">{t("panel.menu.skills")}</span>
                    <kbd className="text-xs text-muted-foreground">/</kbd>
                    <ChevronRightIcon className="size-4 opacity-50 rtl:rotate-180" />
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <LayoutGridIcon className="size-4 opacity-70" />
                    <span className="flex-1">{t("panel.menu.generateApp")}</span>
                    <InfoIcon className="size-4 opacity-50" />
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <LayoutGridIcon className="size-4 opacity-70" />
                    <span className="flex-1">{t("panel.menu.apps")}</span>
                    <ChevronRightIcon className="size-4 opacity-50 rtl:rotate-180" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <MentionTextarea
                textareaRef={textareaRef}
                value={draft}
                segments={mention.segments}
                flash={mention.flash}
                onValueChange={(value, caret) => {
                  setDraft(value);
                  mention.onValueChange(value, caret);
                }}
                onKeyDown={onKeyDown}
                onKeyUp={mention.onKeyUp}
                onClick={mention.refresh}
                onBlur={mention.onBlur}
                onFocus={mention.onFocus}
                placeholder={
                  voice.listening && voice.interimTranscript
                    ? voice.interimTranscript
                    : t("placeholder")
                }
                disabled={sending}
              />
              {voice.supported && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleMic}
                  disabled={sending}
                  aria-label={t("voice")}
                  className={cn(
                    "size-7 shrink-0 rounded-full text-muted-foreground",
                    voice.listening &&
                      "animate-pulse bg-red-500/10 text-red-600 hover:bg-red-500/20",
                  )}
                >
                  {voice.listening ? (
                    <MicOffIcon className="size-4" />
                  ) : (
                    <MicIcon className="size-4" />
                  )}
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                className="size-7 shrink-0 overflow-hidden rounded-full"
                onClick={sending ? stop : handleSend}
                aria-label={sending ? t("composer.stop") : t("send")}
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
                      <StopCircleIcon className="size-3.5" />
                    ) : (
                      <ArrowUpIcon className="size-3.5" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </Button>
              </div>
            </motion.div>
            </div>
            </NoiseBackground>
          </div>
        </div>
      </div>

      <ConversationSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        activeId={conversationId}
        locale={isAr ? "ar" : "en"}
        onSelect={(id) => void switchConversation(id)}
        onNewChat={reset}
      />
      </motion.aside>
    </>
  );
}

// ── Message rendering ─────────────────────────────────────────

const ATTACHMENTS_TAG_RE = /\n*\[Attached images:\s*([^\]]+)\]\s*$/;

function parseUserContent(raw: string): {
  text: string;
  images: string[];
  mentions: Array<{ type: MentionType; display: string }>;
} {
  // Strip the trailing attachments tag first, then the mentions tag. The
  // attached image URLs are surfaced as thumbnails on the bubble so the
  // vendor sees what they sent (not just the stripped text).
  let images: string[] = [];
  const am = raw.match(ATTACHMENTS_TAG_RE);
  if (am) {
    images = am[1]
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }
  const withoutImages = raw.replace(ATTACHMENTS_TAG_RE, "");
  const { text, mentions } = parseMentionTag(withoutImages);
  return { text, images, mentions };
}

function MessageBubble({
  message,
  currency,
  locale,
  onApprovalDecide,
  approvalBusy = false,
  onRetry,
  retrying = false,
  onSuggest,
  planHref,
  planIsCurrent = true,
}: {
  message: VendorAgentMessage;
  currency: string;
  locale: "ar" | "en";
  /** True only on the turn holding the conversation's newest plan snapshot. */
  planIsCurrent?: boolean;
  /** Passed only to the turn whose approval is genuinely still pending on
   *  the server, so older approval cards render as read-only history. */
  onApprovalDecide?: (decisions: AgentApprovalDecision[]) => void;
  approvalBusy?: boolean;
  /** Passed only to the last turn — regenerate rewinds to the last user
   *  prompt, so offering it on an older turn would rerun the wrong one. */
  onRetry?: () => void;
  retrying?: boolean;
  onSuggest?: (text: string) => void;
  /** Where the plan screen is — see `TurnErrorCard`. */
  planHref?: string;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    const { text, images, mentions } = parseUserContent(message.content);
    // A message written in this panel carries its mentions inline, so they are
    // highlighted where they were typed; one written in the full-page chat —
    // or in this panel before it went inline — has nothing in the text to
    // highlight and still needs its pills. Splitting on what is actually
    // present answers both, and is what stops a mention rendering twice.
    const { segments, pills } = splitBubbleMentions(text, mentions);
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] space-y-1.5 text-end">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {images.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="size-16 rounded-lg object-cover border"
                />
              ))}
            </div>
          )}
          {text && (
            <div
              dir="auto"
              className="inline-block rounded-2xl rounded-ee-sm bg-primary px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-primary-foreground [overflow-wrap:anywhere]"
            >
              {segments.map((seg, i) =>
                seg.mention ? (
                  // A tint drawn from the bubble's own foreground, not the
                  // category colour: the bubble is `bg-primary`, and the soft
                  // tints the composer paints on a white card vanish on it.
                  <span
                    key={i}
                    className="box-decoration-clone rounded-[5px] bg-primary-foreground/15 py-[3px] font-medium"
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </div>
          )}
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

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        <AssistantTurn
          parts={message.parts}
          content={message.content}
          toolEvents={message.tool_events}
          currency={currency}
          locale={locale}
          onApprovalDecide={onApprovalDecide}
          approvalBusy={approvalBusy}
          onRetry={onRetry}
          retrying={retrying}
          onSuggest={onSuggest}
          planHref={planHref}
          planIsCurrent={planIsCurrent}
        />
      </div>
    </div>
  );
}

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
  const t = useTranslations("aiChat");
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        {!text && toolEvents.length === 0 && (
          <div
            className="flex items-center gap-2 rounded-2xl rounded-es-sm bg-muted px-3 py-2"
            role="status"
            aria-live="polite"
          >
            <SiriOrb size="32px" animationDuration={20} />
            <ShiningText className="text-xs" text={t("processing")} />
          </div>
        )}
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
