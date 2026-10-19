/**
 * ShopifyQL AST — mirrored from
 * `back-end/src/customer-segments/shopifyql/ast.ts`.
 *
 * Keep the shapes byte-for-byte identical with the backend so:
 *   - The serializer produces the same canonical text on both sides
 *   - Phase 10E can pull both copies into a shared package without diffs
 */

export type Expr = AndExpr | OrExpr | Condition

export interface AndExpr {
  type: "and"
  children: Expr[]
}

export interface OrExpr {
  type: "or"
  children: Expr[]
}

export interface Condition {
  type: "condition"
  field: FieldRef
  operator: Operator
  value: Value
}

export interface FieldRef {
  type: "field"
  name: string
  argument?: Value
}

export type Operator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "IN"
  | "NOT IN"
  | "CONTAINS"
  | "NOT CONTAINS"
  | "IS NULL"
  | "IS NOT NULL"
  | "BETWEEN"
  | "MATCHES"
  | "NOT MATCHES"

export const COMPARISON_OPERATORS: Operator[] = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
]
export const NULLARY_OPERATORS: Operator[] = ["IS NULL", "IS NOT NULL"]
export const LIST_OPERATORS: Operator[] = ["IN", "NOT IN"]
export const MEMBERSHIP_OPERATORS: Operator[] = ["CONTAINS", "NOT CONTAINS"]
export const FUNCTION_OPERATORS: Operator[] = ["MATCHES", "NOT MATCHES"]

export type Value =
  | StringValue
  | NumberValue
  | BooleanValue
  | DateValue
  | DateOffsetValue
  | NamedDateValue
  | TupleValue
  | ListValue
  | BetweenValue
  | FunctionArgsValue
  | NullValue

export interface StringValue {
  type: "string"
  value: string
}
export interface NumberValue {
  type: "number"
  value: number
}
export interface BooleanValue {
  type: "boolean"
  value: boolean
}
export interface DateValue {
  type: "date"
  value: string
}
export interface DateOffsetValue {
  type: "date_offset"
  sign: "-" | "+"
  amount: number
  unit: "d" | "w" | "m" | "y"
}
export interface NamedDateValue {
  type: "named_date"
  name: "today" | "yesterday"
}
export interface TupleValue {
  type: "tuple"
  items: Value[]
}
export interface ListValue {
  type: "list"
  items: Value[]
}
export interface BetweenValue {
  type: "between"
  from: Value
  to: Value
}
export interface FunctionArgsValue {
  type: "function_args"
  args: FunctionArg[]
}
export interface FunctionArg {
  key: string
  operator: Operator
  value: Value
}
export interface NullValue {
  type: "null"
}

export const str = (value: string): StringValue => ({ type: "string", value })
export const num = (value: number): NumberValue => ({ type: "number", value })
export const bool = (value: boolean): BooleanValue => ({
  type: "boolean",
  value,
})
export const date = (value: string): DateValue => ({ type: "date", value })
export const dateOffset = (
  sign: "-" | "+",
  amount: number,
  unit: DateOffsetValue["unit"],
): DateOffsetValue => ({ type: "date_offset", sign, amount, unit })
export const namedDate = (
  name: NamedDateValue["name"],
): NamedDateValue => ({ type: "named_date", name })
export const tuple = (items: Value[]): TupleValue => ({
  type: "tuple",
  items,
})
export const list = (items: Value[]): ListValue => ({ type: "list", items })
export const between = (from: Value, to: Value): BetweenValue => ({
  type: "between",
  from,
  to,
})
export const fnArgs = (args: FunctionArg[]): FunctionArgsValue => ({
  type: "function_args",
  args,
})
export const nullValue = (): NullValue => ({ type: "null" })

export const field = (name: string, argument?: Value): FieldRef => ({
  type: "field",
  name,
  ...(argument !== undefined ? { argument } : {}),
})

export const condition = (
  fieldRef: FieldRef,
  operator: Operator,
  value: Value,
): Condition => ({ type: "condition", field: fieldRef, operator, value })

export const and = (...children: Expr[]): AndExpr => ({
  type: "and",
  children,
})

export const or = (...children: Expr[]): OrExpr => ({ type: "or", children })

export const isCondition = (e: Expr): e is Condition => e.type === "condition"
export const isAnd = (e: Expr): e is AndExpr => e.type === "and"
export const isOr = (e: Expr): e is OrExpr => e.type === "or"
