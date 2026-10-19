import { CheckIcon } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import type { SignupProgressStep } from "../types"

/**
 * The rail turned on its side, for screens with no column to spare: dots joined
 * by a rule, with the step name under each.
 *
 * It carries the titles and drops the descriptions and the percentages. On a
 * phone the card below is already the whole screen, so the row's only job is
 * "which of three, and how far in" — the sentence explaining the step is the
 * card's own subtitle a few pixels lower down.
 *
 * The rule between two steps lights only once the later of the two has been
 * reached, so the row reads as the distance travelled: on the first pane, with
 * the headline still saying 0%, nothing is lit yet.
 */
export function SignupStepper({
  steps,
  activeIndex,
  className,
}: {
  steps: readonly SignupProgressStep[]
  activeIndex: number
  className?: string
}) {
  return (
    <ol className={cn("mx-auto flex w-full max-w-sm items-start", className)}>
      {steps.map((step, index) => {
        const done = index < activeIndex
        const active = index === activeIndex
        const last = index === steps.length - 1

        return (
          <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            {/* Fixed height, and every dot the same box: the row is what keeps
                the rule straight and the labels on one baseline, so "you are
                here" is carried by the dot's fill, never by its size. */}
            <div aria-hidden className="flex h-6 w-full items-center">
              <Segment hidden={index === 0} lit={index <= activeIndex} />

              <span
                className={cn(
                  "mx-1.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  done && "border-emerald-400 bg-emerald-400 text-[#0a0a0a]",
                  active && "border-white bg-transparent",
                  !done && !active && "border-white/25 bg-transparent",
                )}
              >
                {done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : null}
                {active ? <span className="size-2 rounded-full bg-white" /> : null}
              </span>

              <Segment hidden={last} lit={index < activeIndex} />
            </div>

            <p
              className={cn(
                "text-center text-[0.8125rem] leading-tight text-balance",
                active ? "font-medium text-white" : "text-white/45",
              )}
            >
              {step.title}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

/** Half of the rule between two dots. Kept in flow when hidden so the dots of
 *  the first and last steps stay on the same centres as the ones between. */
function Segment({ hidden, lit }: { hidden: boolean; lit: boolean }) {
  return (
    <span
      className={cn(
        "h-px flex-1",
        hidden ? "invisible" : lit ? "bg-white/45" : "bg-white/15",
      )}
    />
  )
}
