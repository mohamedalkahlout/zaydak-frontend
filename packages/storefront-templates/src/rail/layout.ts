/**
 * Where each piece sits on the rail.
 *
 * At rest the pieces share the rack evenly, hung in profile. The piece that
 * turns to face you is wider, so its neighbours step aside until a profile
 * and a front can share the rack with a gap between them.
 */

export interface RailFitInput {
  width: number
  count: number
  /** -1 while every piece stays in profile. */
  active: number
  gap: number
  maxHeight: number
  /** Profile width as a fraction of the piece height. */
  profileRatio: number
  /** Front width as a fraction of the piece height. */
  frontRatio: number
}

export interface RailFit {
  centers: number[]
  height: number
  profile: number
  front: number
}

export function railCenters(
  width: number,
  count: number,
  active: number,
  profile: number,
  front: number,
  gap: number,
): number[] {
  if (count <= 0 || width <= 0) return []
  const even = Array.from(
    { length: count },
    (_, index) => ((index + 0.5) / count) * width,
  )
  if (active < 0 || active >= count) return even

  const centers = [...even]
  const anchor = even[active]!
  for (const direction of [-1, 1] as const) {
    let edge = anchor + direction * (front / 2)
    for (
      let index = active + direction;
      index >= 0 && index < count;
      index += direction
    ) {
      const half = profile / 2
      const pushed = edge + direction * (gap + half)
      const natural = even[index]!
      const unbound = direction < 0 ? Math.min(natural, pushed) : Math.max(natural, pushed)
      const limit = direction < 0 ? half : width - half
      centers[index] =
        direction < 0 ? Math.max(unbound, limit) : Math.min(unbound, limit)
      edge = centers[index]! + direction * half
    }
  }
  const activeHalf = front / 2
  centers[active] = Math.min(
    width - activeHalf,
    Math.max(activeHalf, anchor),
  )
  return centers
}

/**
 * Height comes from the resting rail and stays put when a piece turns.
 * Turning the first or last piece only slides its neighbours; it does not
 * scale the whole rack down.
 */
export function placeRail(input: RailFitInput): RailFit {
  const resting = fitRail({ ...input, active: -1 })
  if (input.active < 0 || input.active >= input.count) return resting
  return {
    ...resting,
    centers: railCenters(
      input.width,
      input.count,
      input.active,
      resting.profile,
      resting.front,
      input.gap,
    ),
  }
}

/** Shrink the pieces until a turned neighbour still fits on the rack. */
export function fitRail({
  width,
  count,
  active,
  gap,
  maxHeight,
  profileRatio,
  frontRatio,
}: RailFitInput): RailFit {
  if (count <= 0 || width <= 0) {
    return { centers: [], height: maxHeight, profile: 0, front: 0 }
  }
  let height = maxHeight
  for (let attempt = 0; attempt < 8; attempt++) {
    const profile = height * profileRatio
    const front = height * frontRatio
    const centers = railCenters(width, count, active, profile, front, gap)
    if (fits(centers, width, active, profile, front, gap) || height <= 150) {
      return { centers, height, profile, front }
    }
    height = Math.max(150, height * 0.88)
  }
  const profile = height * profileRatio
  const front = height * frontRatio
  return {
    centers: railCenters(width, count, active, profile, front, gap),
    height,
    profile,
    front,
  }
}

function fits(
  centers: number[],
  width: number,
  active: number,
  profile: number,
  front: number,
  gap: number,
): boolean {
  const half = (index: number) => (index === active ? front : profile) / 2
  for (let index = 0; index < centers.length; index++) {
    const center = centers[index]!
    const size = half(index)
    if (center - size < -1 || center + size > width + 1) return false
    if (index === 0) continue
    const previous = centers[index - 1]!
    const needed = half(index - 1) + size + gap
    if (center - previous < needed - 1) return false
  }
  return true
}

/** One piece in the middle, the rest a step to either side. `offset` is a drag. */
export function railFocusCenters(
  width: number,
  count: number,
  focus: number,
  step: number,
  offset = 0,
): number[] {
  const mid = width / 2 + offset
  return Array.from(
    { length: count },
    (_, index) => mid + (index - focus) * step,
  )
}
