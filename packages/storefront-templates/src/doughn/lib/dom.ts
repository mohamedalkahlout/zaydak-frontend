/**
 * Style writes for the scroll-driven scene. The scene runs on every scroll frame
 * and most values repeat from one frame to the next, so each write is skipped
 * when the element already holds that value.
 */

const written = new WeakMap<Element, Record<string, string | boolean>>()

function memo(el: Element) {
  let m = written.get(el)
  if (!m) written.set(el, (m = {}))
  return m
}

export function setStyle(el: HTMLElement, prop: string, value: string) {
  const m = memo(el)
  if (m[prop] === value) return
  m[prop] = value
  el.style.setProperty(prop, value)
}

/** A boolean `data-*` attribute, for state the CSS reacts to. */
export function setFlag(el: Element, name: string, on: boolean) {
  const m = memo(el)
  const key = `@${name}`
  if (m[key] === on) return
  m[key] = on
  el.toggleAttribute(name, on)
}
