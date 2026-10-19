"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import { ArrowUp, AudioLines, LoaderCircle, Mic, Plus, Square } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import * as React from "react";

import { cn } from "../lib/utils";
import { useSafeReducedMotion } from "../hooks/use-hydrated";

/**
 * AI chat input — a recreation of the OpenAI-style "Ask anything" prompt box
 * (inspired by Skiper UI's Skiper84). A white glass pill floats over an animated
 * WebGL mesh-gradient halo and renders with a subtle 3D perspective tilt on mount.
 *
 * Behaviour:
 * - The textarea auto-resizes; once the text wraps to a second line the layout
 *   reflows from a single row into a two-row layout (text on top, controls below).
 * - The circular action button morphs between three states: a voice waveform
 *   when empty, an up-arrow when there is text to send, and a spinner (or a stop
 *   square if `onStop` is given) while loading.
 * - `loading` may be controlled via the prop; if omitted and `onSubmit` returns a
 *   promise, the component tracks the in-flight state itself.
 *
 * Self-contained: no props are required. Honours `prefers-reduced-motion`.
 */

const MAX_HEIGHT = 168; // ~7 lines before the textarea starts to scroll
const LINE_HEIGHT = 24; // matches `leading-6` below; used to detect wrapping

/** Soft lavender / blue / pink palette for the mesh-gradient halo. */
const GRADIENT_COLORS = [
  "#C9E4FF",
  "#E3D1FF",
  "#FFD6F0",
  "#D7F0FF",
  "#C3B6FF",
];

/** Soft radial fade so the gradient blends into the page as a halo (cheap; no per-frame blur). */
const HALO_MASK =
  "radial-gradient(120% 120% at 50% 50%, #000 55%, transparent 100%)";

export type AiChatInputLabels = {
  /** Leading "+" attachment button. */
  attach: string;
  /** Microphone / dictation button. */
  mic: string;
  /** Action button while empty (voice mode). */
  voice: string;
  /** Action button when there is text to send. */
  send: string;
  /** Action button while loading, when `onStop` is provided. */
  stop: string;
  /** Action button while loading, when stopping is not supported. */
  generating: string;
};

/** English defaults; pass `labels` to localize (this is a bilingual dashboard). */
const DEFAULT_LABELS: AiChatInputLabels = {
  attach: "Add attachment",
  mic: "Dictate",
  voice: "Use voice",
  send: "Send message",
  stop: "Stop generating",
  generating: "Generating response",
};

export type AiChatInputProps = {
  /** Placeholder shown while the field is empty. */
  placeholder?: string;
  /** Controlled value. Omit for uncontrolled usage. */
  value?: string;
  /** Initial value for uncontrolled usage. */
  defaultValue?: string;
  /** Fired on every keystroke with the current text. */
  onChange?: (value: string) => void;
  /**
   * Fired when the user submits (Enter without Shift, or the send button).
   * If it returns a promise and `loading` is not controlled, the spinner shows
   * until the promise settles.
   */
  onSubmit?: (value: string) => void | Promise<void>;
  /** Fired when the action button is clicked while empty (voice mode). */
  onVoice?: () => void;
  /** Fired by the standalone microphone (dictation) button. */
  onMic?: () => void;
  /** Fired by the leading "+" button (attachments, etc.). */
  onAttach?: () => void;
  /** Fired by the action button while loading. When set, a stop square shows. */
  onStop?: () => void;
  /** Controlled loading state. Overrides the internal in-flight tracking. */
  loading?: boolean;
  /** Shimmering status text shown while loading. */
  loadingText?: string;
  /** Accessible name for the textarea. Defaults to `placeholder`. */
  inputLabel?: string;
  /** Override the (English-by-default) aria-labels for the icon buttons. */
  labels?: Partial<AiChatInputLabels>;
  /** Disable the whole control. */
  disabled?: boolean;
  /** Render the animated mesh-gradient halo behind the pill. Default `true`. */
  showGradient?: boolean;
  /** Class on the outermost wrapper. */
  className?: string;
};

/**
 * Text with a gradient highlight sweeping across it. Used for the loading status.
 */
const TextShimmer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const prefersReducedMotion = useSafeReducedMotion();
  return (
    <motion.span
      className={cn("bg-clip-text text-transparent", className)}
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(23,23,23,0.25) 0%, rgba(23,23,23,0.25) 40%, rgba(23,23,23,0.95) 50%, rgba(23,23,23,0.25) 60%, rgba(23,23,23,0.25) 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
      }}
      animate={
        prefersReducedMotion ? undefined : { backgroundPosition: ["150% 0%", "-150% 0%"] }
      }
      transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
};

const iconMotion = {
  initial: { opacity: 0, scale: 0.5, rotate: -45 },
  animate: { opacity: 1, scale: 1, rotate: 0 },
  exit: { opacity: 0, scale: 0.5, rotate: 45 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

const AiChatInput = ({
  placeholder = "Ask anything...",
  value,
  defaultValue = "",
  onChange,
  onSubmit,
  onVoice,
  onMic,
  onAttach,
  onStop,
  loading,
  loadingText = "Thinking…",
  inputLabel,
  labels,
  disabled = false,
  showGradient = true,
  className,
}: AiChatInputProps) => {
  const prefersReducedMotion = useSafeReducedMotion();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  // Pause the WebGL render loop while the halo is scrolled out of view.
  const inView = useInView(wrapperRef, { margin: "200px" });
  const lbl = { ...DEFAULT_LABELS, ...labels };

  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [internalLoading, setInternalLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const isControlled = value !== undefined;
  const text = isControlled ? value : internalValue;
  const isLoading = loading ?? internalLoading;
  const canSend = text.trim().length > 0;
  const isDisabled = disabled || isLoading;

  // Grow the textarea to fit its content (capped at MAX_HEIGHT) and flip to the
  // two-row layout once the text wraps past the first line.
  const resize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
    // Compare pure content height (minus padding) against ~1.5 lines so wrap
    // detection stays robust to padding / line-height changes.
    const cs = window.getComputedStyle(el);
    const vPad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const lineHeight = parseFloat(cs.lineHeight) || LINE_HEIGHT;
    setExpanded(el.scrollHeight - vPad > lineHeight * 1.5);
  }, []);

  React.useLayoutEffect(() => {
    resize();
  }, [text, resize]);

  const setText = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  };

  const submit = async () => {
    if (!canSend || isDisabled) return;
    const payload = text;
    if (!onSubmit) return;

    if (loading === undefined) {
      // Uncontrolled loading: track the promise ourselves.
      try {
        setInternalLoading(true);
        await onSubmit(payload);
        setText("");
      } finally {
        setInternalLoading(false);
      }
      return;
    }
    onSubmit(payload);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const handleAction = () => {
    if (isLoading) {
      onStop?.();
      return;
    }
    if (canSend) {
      void submit();
      return;
    }
    onVoice?.();
  };

  const actionState = isLoading ? "loading" : canSend ? "send" : "voice";

  // --- Reusable control elements (shared between the two layouts) -----------

  const attachButton = (
    <button
      type="button"
      onClick={onAttach}
      disabled={isDisabled}
      aria-label={lbl.attach}
      className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-500/10 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:outline-none disabled:opacity-40"
    >
      <Plus className="size-5" aria-hidden />
    </button>
  );

  const micButton = (
    <button
      type="button"
      onClick={onMic}
      disabled={isDisabled}
      aria-label={lbl.mic}
      className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-500/10 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:outline-none disabled:opacity-40"
    >
      <Mic className="size-5" aria-hidden />
    </button>
  );

  const actionButton = (
    <motion.button
      type="button"
      onClick={handleAction}
      disabled={disabled || (isLoading && !onStop)}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
      aria-label={
        actionState === "loading"
          ? onStop
            ? lbl.stop
            : lbl.generating
          : actionState === "send"
            ? lbl.send
            : lbl.voice
      }
      className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={actionState} className="grid place-items-center" {...iconMotion}>
          {actionState === "loading" ? (
            onStop ? (
              <Square className="size-4 fill-current" aria-hidden />
            ) : (
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
            )
          ) : actionState === "send" ? (
            <ArrowUp className="size-5" aria-hidden />
          ) : (
            <AudioLines className="size-5" aria-hidden />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );

  const textarea = (
    <textarea
      ref={textareaRef}
      rows={1}
      value={text}
      disabled={isDisabled}
      placeholder={placeholder}
      aria-label={inputLabel ?? placeholder}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      className="w-full resize-none border-0 bg-transparent py-1.5 text-base leading-6 text-neutral-900 placeholder:text-neutral-500 focus:outline-none disabled:opacity-60"
    />
  );

  return (
    <div
      ref={wrapperRef}
      className={cn("relative w-full", className)}
      style={{ perspective: 1200 }}
    >
      {showGradient && (
        <MeshGradient
          colors={GRADIENT_COLORS}
          distortion={1}
          swirl={0.2}
          speed={prefersReducedMotion || !inView ? 0 : 0.25}
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.75rem] opacity-80"
          style={{ WebkitMaskImage: HALO_MASK, maskImage: HALO_MASK }}
        />
      )}

      <motion.div
        initial={
          prefersReducedMotion
            ? false
            : { rotateX: 14, y: 10, opacity: 0 }
        }
        animate={{ rotateX: 0, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        style={{ transformPerspective: 1200, transformOrigin: "center bottom" }}
        aria-busy={isLoading}
        className={cn(
          "rounded-[1.75rem] border border-white/60 bg-white/85 px-3 py-2 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl",
          isDisabled && "cursor-default",
        )}
      >
        <AnimatePresence initial={false}>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="px-2 pt-1 pb-2 text-sm font-medium"
              >
                <TextShimmer>{loadingText}</TextShimmer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {expanded ? (
          // Two-row layout: text on top, controls below.
          <div className="flex flex-col gap-1">
            <div className="px-1.5">{textarea}</div>
            <div className="flex items-center justify-between">
              {attachButton}
              <div className="flex items-center gap-1">
                {micButton}
                {actionButton}
              </div>
            </div>
          </div>
        ) : (
          // Single-row layout.
          <div className="flex items-center gap-1">
            {attachButton}
            <div className="min-w-0 flex-1 px-1">{textarea}</div>
            {micButton}
            {actionButton}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export { AiChatInput, TextShimmer };
