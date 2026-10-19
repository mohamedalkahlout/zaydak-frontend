"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { animate, motion } from "motion/react"
import { ArrowUp, CircleCheck } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"
import { useHydrated } from "@repo/ui/hooks/use-hydrated"

import Image from "@/shared/components/app-image"

export type OrbitRing = "outer" | "inner"

interface OrbitBase {
  ring: OrbitRing
  angle: number
}

export interface OrbitAvatarItem extends OrbitBase {
  kind: "avatar"
  /** When missing, the coloured disc shows `initial` instead. */
  src?: string | null
  alt?: string
  color: string
  initial?: string
  size?: number
}

export interface OrbitPillItem extends OrbitBase {
  kind: "pill"
  icon: ReactNode
  label: string
}

export interface OrbitCardItem extends OrbitBase {
  kind: "card"
  emoji: string
  badge?: string | number
}

export interface OrbitStatusItem extends OrbitBase {
  kind: "status"
  label: string
}

export interface OrbitCheckItem extends OrbitBase {
  kind: "check"
}

export type OrbitItem =
  | OrbitAvatarItem
  | OrbitPillItem
  | OrbitCardItem
  | OrbitStatusItem
  | OrbitCheckItem

export interface OrbitStat {
  value: string
  label: string
}

export interface OrbitTag {
  icon: ReactNode
  label: string
  href?: string
  onClick?: () => void
}

export interface CommunityOrbitProps {
  items: OrbitItem[]
  stats: OrbitStat[]
  headline: ReactNode
  tags?: OrbitTag[]
  minScale?: number
  className?: string
}

const STAGE_W = 1200
const STAGE_H = 490
const CENTER = { x: 600, y: 620 }
const RADIUS: Record<OrbitRing, number> = { outer: 492, inner: 404 }

/**
 * Ring coordinates as rounded `px` strings.
 *
 * Motion SSR serialises numeric `left`/`top` as `"929.212px"` while the
 * client first paint keeps the raw float — a guaranteed hydration mismatch
 * on every orbit item. Rounding + units here keep the layout style out of
 * Motion's rewrite path entirely (position sits on a plain `div`).
 */
function positionOnRing(ring: OrbitRing, angle: number): CSSProperties {
  const rad = (angle * Math.PI) / 180
  const r = RADIUS[ring]
  return {
    left: `${(CENTER.x + r * Math.cos(rad)).toFixed(3)}px`,
    top: `${(CENTER.y - r * Math.sin(rad)).toFixed(3)}px`,
  }
}

/** Arc from left edge through the top to the right edge of the stage. */
function arcPath(r: number) {
  const dy = CENTER.y - STAGE_H
  const dx = Math.sqrt(r * r - dy * dy)
  return `M ${CENTER.x - dx} ${STAGE_H} A ${r} ${r} 0 0 1 ${CENTER.x + dx} ${STAGE_H}`
}

function OrbitAvatar({
  src,
  alt,
  color,
  initial,
  size = 72,
}: OrbitAvatarItem) {
  return (
    <div
      className="rounded-full border border-black/[0.07] bg-white p-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      style={{ width: size, height: size }}
    >
      <div
        className="grid h-full w-full place-items-center overflow-hidden rounded-full text-sm font-semibold tracking-tight text-white"
        style={{ backgroundColor: color }}
      >
        {src ? (
          <Image
            src={src}
            alt={alt ?? ""}
            width={size}
            height={size}
            draggable={false}
            className="h-full w-full translate-y-[8%] scale-[1.08] select-none object-cover object-top"
          />
        ) : (
          <span aria-hidden>{initial ?? "?"}</span>
        )}
      </div>
    </div>
  )
}

function OrbitPill({ icon, label }: OrbitPillItem) {
  return (
    <div className="flex min-h-[27px] items-center gap-2 whitespace-nowrap rounded-full border border-black/[0.08] bg-white px-2.5 py-[5px] text-[12.5px] font-medium text-[#6c6c78] shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
      <span className="flex shrink-0 items-center text-[13px] leading-none">
        {icon}
      </span>
      <span className="leading-none">{label}</span>
    </div>
  )
}

function OrbitCard({ emoji, badge }: OrbitCardItem) {
  return (
    <div className="relative flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-black/[0.08] bg-[#f7f7f8] text-[22px] leading-none shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      <span className="select-none">{emoji}</span>
      {badge !== undefined ? (
        <span className="absolute -end-2 -bottom-[5px] flex h-[18px] items-center gap-0.5 rounded-[5px] border border-black/[0.08] bg-white px-1.5 text-[10px] font-medium leading-none text-[#7a7a7a] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <ArrowUp size={9} strokeWidth={2.2} />
          {badge}
        </span>
      ) : null}
    </div>
  )
}

function OrbitStatus({ label }: OrbitStatusItem) {
  return (
    <div className="flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full border border-[#a3d5b3] bg-[#cbe8d3] px-2.5 text-[13.5px] font-medium text-[#2f5b3a] shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
      <CircleCheck
        size={15}
        strokeWidth={2.2}
        className="fill-[#2e7d3e] text-[#cbe8d3]"
      />
      {label}
    </div>
  )
}

function OrbitCheck() {
  return (
    <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[#a9d8b8] bg-[#c3e5cd] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <CircleCheck
        size={17}
        strokeWidth={2.4}
        className="fill-[#2e7d3e] text-[#c3e5cd]"
      />
    </div>
  )
}

function renderItem(item: OrbitItem) {
  switch (item.kind) {
    case "avatar":
      return <OrbitAvatar {...item} />
    case "pill":
      return <OrbitPill {...item} />
    case "card":
      return <OrbitCard {...item} />
    case "status":
      return <OrbitStatus {...item} />
    case "check":
      return <OrbitCheck />
  }
}

function splitValue(value: string) {
  const match = value.match(/^([^\d]*)([\d.,]+)(.*)$/)
  if (!match) return null
  const raw = match[2]!.replace(/,/g, "")
  const decimals = (raw.split(".")[1] ?? "").length
  return {
    prefix: match[1]!,
    target: parseFloat(raw),
    decimals,
    suffix: match[3]!,
  }
}

function CountUp({
  value,
  delay,
  active = true,
}: {
  value: string
  delay: number
  /** When false, show the final figure without counting (SSR / pre-motion). */
  active?: boolean
}) {
  const parts = splitValue(value)
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!parts || !active) return
    const controls = animate(0, parts.target, {
      delay,
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setN(v),
    })
    return () => controls.stop()
    // Count from zero whenever the displayed value changes; `parts` is derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [value, delay, active])

  if (!parts) return <>{value}</>
  // Settled figure until motion is allowed — matches SSR and the first client
  // paint, so the count-up never hydrates as "0" against a streamed "12".
  const shown = active ? n : parts.target
  return (
    <>
      {parts.prefix}
      {shown.toFixed(parts.decimals)}
      {parts.suffix}
    </>
  )
}

/**
 * Marketplace social-proof band: orbiting shop marks + count-up stats above
 * a headline and tag chips. Presentational — callers supply items, copy, and
 * numbers (see `CommunityOrbitSection` on `/`).
 */
export function CommunityOrbit({
  items,
  stats,
  headline,
  tags = [],
  minScale = 0.6,
  className,
}: CommunityOrbitProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  // Motion's SSR path stringifies `opacity` / `transform` differently than the
  // client first paint (`"0"` vs `0`). Gate entrance + pathLength animations
  // until after mount so server and the hydrating tree both render the settled
  // end state, then play.
  const motionReady = useHydrated()

  // Fixed design size, then shrink to fit the frame.
  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () =>
      setScale(Math.min(1, Math.max(minScale, frame.clientWidth / STAGE_W)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [minScale])

  return (
    <section
      className={cn(
        "w-full bg-white px-4 pb-14 text-[#1f1f1f]",
        className,
      )}
    >
      <div
        ref={frameRef}
        className="relative mx-auto w-full max-w-[1200px] overflow-hidden"
        style={{ height: STAGE_H * scale }}
      >
        <div
          className="absolute top-0 left-1/2"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={STAGE_W}
            height={STAGE_H}
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            fill="none"
            style={{
              maskImage:
                "linear-gradient(to bottom, #000 62%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, #000 62%, transparent 100%)",
            }}
          >
            <motion.path
              d={arcPath(RADIUS.outer)}
              className="stroke-[#e4e4e4]"
              strokeWidth={2}
              initial={false}
              animate={{ pathLength: 1 }}
              transition={{ duration: motionReady ? 1.4 : 0, ease: "easeOut" }}
            />
            <motion.path
              d={arcPath(RADIUS.inner)}
              className="stroke-[#dcdcdc]"
              strokeWidth={3}
              initial={false}
              animate={{ pathLength: 1 }}
              transition={{
                duration: motionReady ? 1.4 : 0,
                ease: "easeOut",
                delay: motionReady ? 0.1 : 0,
              }}
            />
          </svg>

          {items.map((item, i) => (
            <div
              key={`${item.kind}-${item.ring}-${item.angle}-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={positionOnRing(item.ring, item.angle)}
            >
              <motion.div
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: motionReady ? 0.5 : 0,
                  delay: motionReady ? 0.5 + i * 0.07 : 0,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.div
                  animate={motionReady ? { y: [0, -4, 0] } : { y: 0 }}
                  transition={{
                    duration: 4 + (i % 4) * 0.6,
                    repeat: motionReady ? Infinity : 0,
                    ease: "easeInOut",
                    delay: (i * 0.4) % 2,
                  }}
                  whileHover={{ scale: 1.06 }}
                >
                  {renderItem(item)}
                </motion.div>
              </motion.div>
            </div>
          ))}

          <div className="absolute top-[393px] left-1/2 grid -translate-x-1/2 auto-cols-fr grid-flow-col gap-7">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="flex flex-col items-center"
                initial={false}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: motionReady ? 0.6 : 0,
                  delay: motionReady ? 0.9 + i * 0.12 : 0,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <span className="text-[48px] leading-none font-medium tracking-[-0.02em] text-[#0b2921] tabular-nums">
                  <CountUp
                    value={s.value}
                    delay={0.9 + i * 0.12}
                    active={motionReady}
                  />
                </span>
                <span className="mt-[15px] text-[14px] leading-none text-[#5e6966]">
                  {s.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <motion.h2
        className="mx-auto mt-2 max-w-[600px] text-center text-[26px] leading-[1.18] font-[450] tracking-[-0.01em] sm:text-[34px]"
        initial={false}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{
          duration: motionReady ? 0.7 : 0,
          delay: motionReady ? 1.3 : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {headline}
      </motion.h2>

      {tags.length > 0 ? (
        <div className="mx-auto mt-[35px] flex max-w-[760px] flex-wrap justify-center gap-3">
          {tags.map((tag, i) => {
            const Tag = (tag.href ? motion.a : motion.button) as typeof motion.a
            return (
              <Tag
                key={tag.label}
                {...(tag.href
                  ? { href: tag.href }
                  : { type: "button" as const })}
                onClick={tag.onClick}
                initial={false}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: motionReady ? 0.5 : 0,
                  delay: motionReady ? 1.6 + i * 0.08 : 0,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                className="group flex h-10 items-center gap-2.5 rounded-full border border-black/[0.08] bg-white pr-4 pl-1.5 text-[14px] font-medium text-[#3a3a3a] shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:border-black/[0.14] hover:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.18)] focus-visible:ring-2 focus-visible:ring-[#2e7d3e]/40 focus-visible:outline-none active:shadow-none"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4f0] text-[#2e7d3e] transition-colors group-hover:bg-[#2e7d3e] group-hover:text-white [&>svg]:h-[15px] [&>svg]:w-[15px]">
                  {tag.icon}
                </span>
                {tag.label}
              </Tag>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
