"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

import { cn } from "../lib/utils";

type AppleSwitchSize = "sm" | "md" | "lg";
type AppleSwitchTone = "neutral" | "accent";

type SizePreset = {
  trackWidth: number;
  trackHeight: number;
  thumbSize: number;
  thumbStretch: number;
  padding: number;
  labelGap: number;
  labelSize: string;
  descriptionSize: string;
};

const SIZE_PRESETS: Record<AppleSwitchSize, SizePreset> = {
  sm: {
    trackWidth: 36,
    trackHeight: 22,
    thumbSize: 18,
    thumbStretch: 24,
    padding: 2,
    labelGap: 8,
    labelSize: "text-xs",
    descriptionSize: "text-[11px]",
  },
  md: {
    trackWidth: 48,
    trackHeight: 28,
    thumbSize: 24,
    thumbStretch: 32,
    padding: 2,
    labelGap: 10,
    labelSize: "text-sm",
    descriptionSize: "text-xs",
  },
  lg: {
    trackWidth: 60,
    trackHeight: 34,
    thumbSize: 30,
    thumbStretch: 40,
    padding: 2,
    labelGap: 12,
    labelSize: "text-base",
    descriptionSize: "text-sm",
  },
};

const TONE_CLASSES: Record<AppleSwitchTone, { trackOn: string; glow: string }> = {
  neutral: {
    trackOn: "bg-foreground",
    glow: "bg-foreground/40",
  },
  accent: {
    trackOn: "bg-primary",
    glow: "bg-primary/45",
  },
};

const DRAG_THRESHOLD = 3;

export interface AppleSwitchProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "value" | "defaultValue"
  > {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (value: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  labelSide?: "left" | "right";
  size?: AppleSwitchSize;
  tone?: AppleSwitchTone;
  disabled?: boolean;
}

function useStableId(provided?: string) {
  // `useId` is already unique per instance and stable across SSR/hydration; the
  // module-level counter this used to append was never incremented, so it only
  // ever contributed a literal "-0".
  const reactId = React.useId();
  return provided ?? `apple-switch-${reactId.replace(/:/g, "")}`;
}

/**
 * The direction actually in effect for an element, not a prop.
 *
 * The nearest `dir` ancestor is checked first because that is what the
 * document says, and it answers in every environment; the computed style is
 * the fallback for a page that sets `direction` in CSS alone and for
 * `dir="auto"`, where only the browser knows what the text resolved to.
 */
function isRtl(el: HTMLElement) {
  if (typeof window === "undefined") return false;
  const declared = el.closest("[dir]")?.getAttribute("dir")?.toLowerCase();
  if (declared === "rtl") return true;
  if (declared === "ltr") return false;
  return window.getComputedStyle(el).direction === "rtl";
}

export function AppleSwitch({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  description,
  labelSide = "right",
  size = "md",
  tone = "neutral",
  disabled = false,
  className,
  id,
  onClick,
  ...buttonProps
}: AppleSwitchProps) {
  const preset = SIZE_PRESETS[size];
  const tones = TONE_CLASSES[tone];

  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = React.useState(
    defaultChecked ?? false,
  );
  const isOn = isControlled ? !!checked : internalChecked;

  const generatedId = useStableId(id);

  const travel = preset.trackWidth - preset.thumbSize - preset.padding * 2;

  const activeProgress = useSpring(isOn ? 1 : 0, {
    stiffness: 420,
    damping: 32,
    mass: 0.6,
  });

  const grabProgress = useSpring(0, {
    stiffness: 520,
    damping: 28,
    mass: 0.5,
  });

  React.useEffect(() => {
    activeProgress.set(isOn ? 1 : 0);
  }, [isOn, activeProgress]);

  const dragX = useMotionValue(isOn ? 1 : 0);
  const isDraggingRef = React.useRef(false);
  const dragStartXRef = React.useRef(0);
  // Pointer deltas are viewport pixels, so a rightward drag reads the same in
  // both scripts — but under RTL the track is mirrored and "on" is to the
  // left. Sampled at pointer-down from the element's own computed direction
  // rather than held in state: nothing renders from it, and a locale change
  // cannot happen mid-drag.
  const dragSignRef = React.useRef(1);
  const dragStartProgressRef = React.useRef(0);
  const dragMovedRef = React.useRef(false);
  const suppressNextClickRef = React.useRef(false);

  const thumbX = useTransform(activeProgress, (v) => preset.padding + v * travel);
  const thumbWidth = useTransform(
    grabProgress,
    (g) => preset.thumbSize + (preset.thumbStretch - preset.thumbSize) * g,
  );

  const thumbXAdjusted = useTransform(
    [thumbX, thumbWidth, activeProgress],
    ([x, w, p]: number[]) => {
      const extra = w - preset.thumbSize;
      return x - extra * p;
    },
  );

  const trackFillOpacity = useTransform(activeProgress, [0, 1], [0, 1]);
  const glowOpacity = useTransform(grabProgress, [0, 1], [0, 0.7]);
  const glowScale = useTransform(grabProgress, [0, 1], [0.9, 1.15]);

  const commit = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalChecked(value);
      onCheckedChange?.(value);
    },
    [isControlled, onCheckedChange],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.button !== undefined && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSignRef.current = isRtl(event.currentTarget) ? -1 : 1;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragStartProgressRef.current = activeProgress.get();
    dragX.set(dragStartProgressRef.current);
    grabProgress.set(1);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current || disabled) return;
    const dx = (event.clientX - dragStartXRef.current) * dragSignRef.current;
    if (Math.abs(dx) > DRAG_THRESHOLD) dragMovedRef.current = true;

    const next = Math.min(
      1,
      Math.max(0, dragStartProgressRef.current + dx / travel),
    );
    dragX.set(next);
    activeProgress.set(next);
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // pointer was already released
    }
    grabProgress.set(0);

    if (dragMovedRef.current) {
      suppressNextClickRef.current = true;
      const settled = dragX.get() >= 0.5;
      activeProgress.set(settled ? 1 : 0);
      if (settled !== isOn) commit(settled);
      else activeProgress.set(isOn ? 1 : 0);
    } else {
      activeProgress.set(isOn ? 1 : 0);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
    if (event.defaultPrevented) return;
    commit(!isOn);
  };

  const switchEl = (
    <button
      type="button"
      role="switch"
      id={label ? generatedId : id}
      aria-checked={isOn}
      data-state={isOn ? "checked" : "unchecked"}
      data-disabled={disabled || undefined}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClick={handleClick}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors",
        // The thumb is pinned `left-0` and driven by a motion `x`, and neither
        // is direction-aware. Mirroring the track is the whole fix: every
        // layer inside it — the fill, the glow, the round thumb — is
        // symmetric, so the only thing that changes is which way "on" lies.
        "rtl:-scale-x-100",
        "bg-muted-foreground/30",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "touch-none select-none",
        className,
      )}
      style={{
        width: preset.trackWidth,
        height: preset.trackHeight,
      }}
      {...buttonProps}
    >
      <motion.span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full",
          tones.trackOn,
        )}
        style={{ opacity: trackFillOpacity }}
      />

      <motion.span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full blur-md",
          tones.glow,
        )}
        style={{ opacity: glowOpacity, scale: glowScale }}
      />

      <motion.span
        aria-hidden
        data-slot="apple-switch-thumb"
        className="pointer-events-none absolute left-0 top-1/2 block -translate-y-1/2 rounded-full bg-background shadow-[0_2px_6px_rgba(0,0,0,0.18)] ring-0"
        style={{
          x: thumbXAdjusted,
          width: thumbWidth,
          height: preset.thumbSize,
        }}
      />
    </button>
  );

  if (!label && !description) return switchEl;

  const textBlock = (
    <span className="flex flex-col">
      {label ? (
        <span className={cn("font-medium leading-tight", preset.labelSize)}>
          {label}
        </span>
      ) : null}
      {description ? (
        <span
          className={cn(
            "text-muted-foreground leading-snug",
            preset.descriptionSize,
          )}
        >
          {description}
        </span>
      ) : null}
    </span>
  );

  return (
    <label
      htmlFor={generatedId}
      className={cn(
        "inline-flex items-center",
        labelSide === "left" && "flex-row-reverse",
        disabled && "cursor-not-allowed opacity-70",
      )}
      style={{ gap: preset.labelGap }}
    >
      {switchEl}
      {textBlock}
    </label>
  );
}

export default AppleSwitch;
