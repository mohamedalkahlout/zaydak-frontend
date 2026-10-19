"use client";

import { motion } from "motion/react";
import * as React from "react";

import { useSafeReducedMotion } from "../hooks/use-hydrated";
import { cn } from "../lib/utils";

/**
 * Status text with a highlight sweeping across it — the "thinking…" indicator
 * shown while the assistant is working. Adapted from HextaUI's ShiningText.
 *
 * The sweep is built from the theme tokens (`--muted-foreground` at rest,
 * `--foreground` at the crest) rather than fixed greys, so it reads in both
 * light and dark. Under `prefers-reduced-motion` it degrades to plain muted
 * text — no gradient, no animation.
 *
 * Presentational only: pass an already-localized string as `text`.
 */

const DEFAULT_BASE = "var(--muted-foreground)";
const DEFAULT_CREST = "var(--foreground)";

const shineGradient = (base: string, crest: string) =>
  [
    "linear-gradient(110deg,",
    `${base} 0%,`,
    `${base} 35%,`,
    `${crest} 50%,`,
    `${base} 65%,`,
    `${base} 100%)`,
  ].join(" ");

/** Drag/animation handlers collide with motion's props of the same name. */
type SpanProps = Omit<
  React.ComponentProps<"span">,
  | "children"
  | "style"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
>;

export interface ShiningTextProps extends SpanProps {
  /** Already-localized string to render. */
  text: string;
  /** Seconds for one full sweep. */
  duration?: number;
  /**
   * The text's resting colour, and the colour at the crest of the sweep. Any
   * CSS colour. Default to the theme tokens; override on a surface that is
   * pinned to one scheme (the enhance canvas is always dark, so tokens that
   * flip with the theme would read as invisible there half the time).
   */
  baseColor?: string;
  crestColor?: string;
}

export function ShiningText({
  text,
  duration = 2,
  baseColor = DEFAULT_BASE,
  crestColor = DEFAULT_CREST,
  className,
  ...props
}: ShiningTextProps) {
  const reduced = useSafeReducedMotion();
  const custom = baseColor !== DEFAULT_BASE;

  if (reduced) {
    return (
      <span
        className={cn(
          "inline-block",
          !custom && "text-muted-foreground",
          className,
        )}
        style={custom ? { color: baseColor } : undefined}
        {...props}
      >
        {text}
      </span>
    );
  }

  return (
    <motion.span
      className={cn("inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: shineGradient(baseColor, crestColor),
        backgroundSize: "200% 100%",
      }}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{ repeat: Infinity, duration, ease: "linear" }}
      {...props}
    >
      {text}
    </motion.span>
  );
}
