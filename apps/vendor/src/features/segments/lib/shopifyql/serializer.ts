/**
 * ShopifyQL serializer — frontend mirror of the backend serializer.
 * Round-trip safe: parse(serialize(ast)) deep-equals ast.
 */

import {
  AndExpr,
  Condition,
  Expr,
  FieldRef,
  FunctionArg,
  Operator,
  OrExpr,
  Value,
  isAnd,
  isOr,
} from "./ast"

export function serializeShopifyQL(expr: Expr): string {
  return serializeExpr(expr, "top")
}

type Ctx = "top" | "and" | "or"

function serializeExpr(expr: Expr, ctx: Ctx): string {
  if (isOr(expr)) return serializeOr(expr, ctx)
  if (isAnd(expr)) return serializeAnd(expr, ctx)
  return serializeCondition(expr)
}

function serializeOr(expr: OrExpr, ctx: Ctx): string {
  const inner = expr.children.map((c) => serializeExpr(c, "or")).join(" OR ")
  return ctx === "and" ? `(${inner})` : inner
}

function serializeAnd(expr: AndExpr, _ctx: Ctx): string {
  return expr.children.map((c) => serializeExpr(c, "and")).join(" AND ")
}

function serializeCondition(c: Condition): string {
  const fieldText = serializeField(c.field)
  return `${fieldText} ${serializeOpAndValue(c.operator, c.value)}`
}

function serializeField(f: FieldRef): string {
  if (f.argument === undefined) return f.name
  return `${f.name} (${serializeValue(f.argument)})`
}

function serializeOpAndValue(op: Operator, v: Value): string {
  switch (op) {
    case "IS NULL":
      return "IS NULL"
    case "IS NOT NULL":
      return "IS NOT NULL"
    case "IN":
    case "NOT IN": {
      if (v.type !== "list") {
        throw new Error(`${op} requires a list value`)
      }
      return `${op} (${v.items.map(serializeValue).join(", ")})`
    }
    case "BETWEEN": {
      if (v.type !== "between") {
        throw new Error("BETWEEN requires a between value")
      }
      return `BETWEEN ${serializeValue(v.from)} AND ${serializeValue(v.to)}`
    }
    case "MATCHES":
    case "NOT MATCHES": {
      if (v.type !== "function_args") {
        throw new Error(`${op} requires a function_args value`)
      }
      return `${op} (${v.args.map(serializeFunctionArg).join(", ")})`
    }
    case "CONTAINS":
    case "NOT CONTAINS":
      return `${op} ${serializeValue(v)}`
    default:
      return `${op} ${serializeValue(v)}`
  }
}

function serializeFunctionArg(arg: FunctionArg): string {
  return `${arg.key} ${serializeOpAndValue(arg.operator, arg.value)}`
}

export function serializeValue(v: Value): string {
  switch (v.type) {
    case "string":
      return `'${v.value.replace(/'/g, "''")}'`
    case "number":
      return String(v.value)
    case "boolean":
      return v.value ? "TRUE" : "FALSE"
    case "date":
      return v.value
    case "date_offset":
      return `${v.sign}${v.amount}${v.unit}`
    case "named_date":
      return v.name
    case "tuple":
      return `(${v.items.map(serializeValue).join(", ")})`
    case "list":
      return `(${v.items.map(serializeValue).join(", ")})`
    case "between":
      return `BETWEEN ${serializeValue(v.from)} AND ${serializeValue(v.to)}`
    case "function_args":
      return `(${v.args.map(serializeFunctionArg).join(", ")})`
    case "null":
      return "NULL"
  }
}
