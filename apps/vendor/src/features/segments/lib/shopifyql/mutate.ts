/**
 * AST mutation helpers — the Phase 10A engine.
 *
 * Why these exist:
 *   The textarea-based editor used to mutate query state by manipulating raw
 *   strings (slice + insert at cursor). That works for free-form typing but
 *   breaks for higher-level operations like:
 *     - "delete this chip"        (Phase 10C)
 *     - "replace operator MATCHES → NOT MATCHES on chip #3"
 *     - "wrap the last two conditions in an OR group"  (Phase 10D)
 *     - "AI explain → suggest narrowing this exact condition"
 *
 *   The chip overlay consumes these helpers, pipes its result back through
 *   the serializer, then the editor's text re-binds to RHF.
 *
 * Design notes:
 *   - Everything is pure / immutable — we always return a fresh AST node.
 *   - We flatten the tree into a "linear conditions view" for the UI. The
 *     index in that flat view is the addressing scheme the UI uses.
 *   - Top-level logic (AND vs OR) is preserved when the user removes one
 *     side of a binary expression — the survivor is hoisted.
 */

import {
  AndExpr,
  Condition,
  Expr,
  OrExpr,
  and,
  isAnd,
  isCondition,
  isOr,
  or,
} from "./ast"

/**
 * The top-level logic operator. AST allows arbitrary nesting; the UI
 * flattens the top group into a single chip strip so this is what the
 * chip overlay actually needs to know.
 */
export type TopLogic = "AND" | "OR"

export interface FlatCondition {
  /** Stable position in the depth-first walk of the AST. */
  index: number
  /** The condition node itself (read-only — clone before mutating). */
  condition: Condition
}

/**
 * Walk the AST in source order and yield each leaf condition with its
 * positional index. Index 0 = leftmost condition, regardless of nesting.
 */
export function flattenConditions(expr: Expr): FlatCondition[] {
  const out: FlatCondition[] = []
  let i = 0
  const visit = (e: Expr): void => {
    if (isCondition(e)) {
      out.push({ index: i++, condition: e })
      return
    }
    e.children.forEach(visit)
  }
  visit(expr)
  return out
}

/**
 * Detect the top-level connective. A single leaf condition has no logic;
 * pure conjunction → AND; pure disjunction → OR; anything else → undefined
 * (the chip overlay will fall back to text-only mode then).
 */
export function getTopLogic(expr: Expr): TopLogic | undefined {
  if (isCondition(expr)) return undefined
  if (isAnd(expr)) return "AND"
  if (isOr(expr)) return "OR"
  return undefined
}

/**
 * Replace the leaf condition at `targetIdx` with a new one. Other
 * conditions, structure, and grouping are preserved.
 */
export function replaceConditionAt(
  expr: Expr,
  targetIdx: number,
  replacement: Condition,
): Expr {
  let i = 0
  const walk = (e: Expr): Expr => {
    if (isCondition(e)) {
      const ret = i === targetIdx ? replacement : e
      i++
      return ret
    }
    const children = e.children.map(walk)
    if (isAnd(e)) return { type: "and", children } as AndExpr
    return { type: "or", children } as OrExpr
  }
  return walk(expr)
}

/**
 * Remove the leaf at `targetIdx`. If removing leaves a parent with a
 * single child, the survivor is hoisted up so we don't produce one-child
 * AND/OR nodes (which serialize awkwardly).
 */
export function removeConditionAt(expr: Expr, targetIdx: number): Expr | null {
  let i = 0
  const walk = (e: Expr): Expr | null => {
    if (isCondition(e)) {
      const keep = i !== targetIdx
      i++
      return keep ? e : null
    }
    const kept = e.children.map(walk).filter((c): c is Expr => c !== null)
    if (kept.length === 0) return null
    if (kept.length === 1) return kept[0]
    if (isAnd(e)) return { type: "and", children: kept } as AndExpr
    return { type: "or", children: kept } as OrExpr
  }
  return walk(expr)
}

/**
 * Append `cond` to the AST under the existing top-level logic. If `expr`
 * is a single condition, we wrap it in an AND group together with `cond`.
 * If `expr` is null (empty editor), we just return the condition.
 */
export function appendCondition(
  expr: Expr | null,
  cond: Condition,
  logic: TopLogic = "AND",
): Expr {
  if (expr === null) return cond
  if (isCondition(expr)) {
    return logic === "OR" ? or(expr, cond) : and(expr, cond)
  }
  const currentLogic = getTopLogic(expr)
  if (currentLogic === logic) {
    const children = [...expr.children, cond]
    return logic === "AND"
      ? ({ type: "and", children } as AndExpr)
      : ({ type: "or", children } as OrExpr)
  }
  return logic === "OR" ? or(expr, cond) : and(expr, cond)
}

/**
 * Set the top-level logic (AND ↔ OR) without changing the conditions.
 * If `expr` is a single condition, nothing to flip; we return as-is.
 */
export function setTopLogic(expr: Expr, logic: TopLogic): Expr {
  if (isCondition(expr)) return expr
  if (getTopLogic(expr) === logic) return expr
  // The children may themselves be groups — we only swap the outer
  // connective, leaving inner groups alone. This matches the visual
  // builder's "flat strip" model.
  if (logic === "AND") return { type: "and", children: expr.children }
  return { type: "or", children: expr.children }
}

/**
 * Parse-resilient guard: returns `null` when the AST is unsafe to render
 * as chips (deeply nested mixed groups). The chip overlay uses this to
 * decide whether to show chips or fall back to text-only mode.
 *
 * Heuristic: chips are safe iff the top level is one of:
 *   - A single Condition
 *   - An AND/OR whose children are all Conditions
 */
export function canRenderAsChipStrip(expr: Expr): boolean {
  if (isCondition(expr)) return true
  return expr.children.every(isCondition)
}
