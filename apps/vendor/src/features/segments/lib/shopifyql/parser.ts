/**
 * ShopifyQL parser — frontend mirror of the backend parser.
 * Same recursive-descent grammar, same AST output.
 */

import {
  AndExpr,
  Condition,
  Expr,
  FieldRef,
  FunctionArg,
  NumberValue,
  Operator,
  OrExpr,
  StringValue,
  TupleValue,
  Value,
  and,
  between,
  bool,
  condition,
  date,
  dateOffset,
  field,
  fnArgs,
  list,
  namedDate,
  nullValue,
  num,
  or,
  str,
  tuple,
} from "./ast"
import { Token, TokenType } from "./tokens"
import { tokenize } from "./lexer"

export class ParserError extends Error {
  constructor(
    message: string,
    public readonly column: number,
  ) {
    super(`Parser error at column ${column}: ${message}`)
    this.name = "ParserError"
  }
}

export function parseShopifyQL(source: string): Expr {
  const tokens = tokenize(source)
  const parser = new Parser(tokens)
  const expr = parser.parseExpression()
  parser.expect(TokenType.EOF, "extra input after expression")
  return expr
}

class Parser {
  private pos = 0
  constructor(private readonly tokens: Token[]) {}

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset]
  }

  private advance(): Token {
    return this.tokens[this.pos++]
  }

  private match(...types: TokenType[]): Token | null {
    if (types.includes(this.peek().type)) return this.advance()
    return null
  }

  expect(type: TokenType, message?: string): Token {
    const tok = this.peek()
    if (tok.type !== type) {
      throw new ParserError(
        message ?? `expected ${type}, got ${tok.type} ('${tok.text}')`,
        tok.start,
      )
    }
    return this.advance()
  }

  parseExpression(): Expr {
    return this.parseOr()
  }

  private parseOr(): Expr {
    const first = this.parseAnd()
    const rest: Expr[] = []
    while (this.match(TokenType.OR)) rest.push(this.parseAnd())
    if (!rest.length) return first
    return or(first, ...rest) as OrExpr
  }

  private parseAnd(): Expr {
    const first = this.parseUnary()
    const rest: Expr[] = []
    while (this.match(TokenType.AND)) rest.push(this.parseUnary())
    if (!rest.length) return first
    return and(first, ...rest) as AndExpr
  }

  private parseUnary(): Expr {
    if (this.match(TokenType.LPAREN)) {
      const inner = this.parseExpression()
      this.expect(TokenType.RPAREN, "expected ) closing group")
      return inner
    }
    return this.parseCondition()
  }

  private parseCondition(): Condition {
    const fieldRef = this.parseFieldRef()
    const { operator, value } = this.parseOpClause()
    return condition(fieldRef, operator, value)
  }

  private parseFieldRef(): FieldRef {
    const identTok = this.peek()
    if (identTok.type !== TokenType.IDENT) {
      throw new ParserError(
        `expected field name, got '${identTok.text}'`,
        identTok.start,
      )
    }
    this.advance()
    let argument: Value | undefined
    if (this.peek().type === TokenType.LPAREN) {
      const save = this.pos
      try {
        this.advance()
        const v = this.parseValue()
        if (this.peek().type !== TokenType.RPAREN) {
          throw new Error("not a field arg")
        }
        this.advance()
        if (!isOperatorStart(this.peek())) {
          throw new Error("not a field arg")
        }
        argument = v
      } catch {
        this.pos = save
      }
    }
    return field(identTok.text, argument)
  }

  private parseOpClause(): { operator: Operator; value: Value } {
    const tok = this.peek()
    switch (tok.type) {
      case TokenType.EQ:
        this.advance()
        return { operator: "=", value: this.parseValue() }
      case TokenType.NEQ:
        this.advance()
        return { operator: "!=", value: this.parseValue() }
      case TokenType.GT:
        this.advance()
        return { operator: ">", value: this.parseValue() }
      case TokenType.GTE:
        this.advance()
        return { operator: ">=", value: this.parseValue() }
      case TokenType.LT:
        this.advance()
        return { operator: "<", value: this.parseValue() }
      case TokenType.LTE:
        this.advance()
        return { operator: "<=", value: this.parseValue() }
      case TokenType.IN:
        this.advance()
        return { operator: "IN", value: this.parseListValue() }
      case TokenType.CONTAINS:
        this.advance()
        return { operator: "CONTAINS", value: this.parseValue() }
      case TokenType.IS: {
        this.advance()
        const isNot = !!this.match(TokenType.NOT)
        this.expect(TokenType.NULL, "expected NULL after IS")
        return {
          operator: isNot ? "IS NOT NULL" : "IS NULL",
          value: nullValue(),
        }
      }
      case TokenType.BETWEEN: {
        this.advance()
        const lo = this.parseValue()
        this.expect(TokenType.AND, "expected AND in BETWEEN")
        const hi = this.parseValue()
        return { operator: "BETWEEN", value: between(lo, hi) }
      }
      case TokenType.MATCHES:
        this.advance()
        return { operator: "MATCHES", value: this.parseFunctionArgs() }
      case TokenType.NOT: {
        this.advance()
        const next = this.peek()
        if (next.type === TokenType.IN) {
          this.advance()
          return { operator: "NOT IN", value: this.parseListValue() }
        }
        if (next.type === TokenType.CONTAINS) {
          this.advance()
          return { operator: "NOT CONTAINS", value: this.parseValue() }
        }
        if (next.type === TokenType.MATCHES) {
          this.advance()
          return {
            operator: "NOT MATCHES",
            value: this.parseFunctionArgs(),
          }
        }
        throw new ParserError(
          `unexpected token after NOT: '${next.text}'`,
          next.start,
        )
      }
      default:
        throw new ParserError(
          `expected operator, got '${tok.text}'`,
          tok.start,
        )
    }
  }

  private parseValue(): Value {
    const tok = this.peek()
    switch (tok.type) {
      case TokenType.STRING:
        this.advance()
        return str(tok.value as string) as StringValue
      case TokenType.NUMBER:
        this.advance()
        return num(tok.value as number) as NumberValue
      case TokenType.TRUE:
        this.advance()
        return bool(true)
      case TokenType.FALSE:
        this.advance()
        return bool(false)
      case TokenType.DATE:
        this.advance()
        return date(tok.value as string)
      case TokenType.DATE_OFFSET:
        this.advance()
        return parseDateOffset(tok.text, tok.start)
      case TokenType.TODAY:
        this.advance()
        return namedDate("today")
      case TokenType.YESTERDAY:
        this.advance()
        return namedDate("yesterday")
      case TokenType.LPAREN: {
        this.advance()
        const items: Value[] = [this.parseValue()]
        while (this.match(TokenType.COMMA)) items.push(this.parseValue())
        this.expect(TokenType.RPAREN, "expected ) closing value group")
        if (items.length === 1) return items[0]
        return tuple(items) as TupleValue
      }
      default:
        throw new ParserError(
          `expected value, got '${tok.text}'`,
          tok.start,
        )
    }
  }

  private parseListValue(): Value {
    this.expect(TokenType.LPAREN, "expected ( starting IN list")
    const items: Value[] = [this.parseValue()]
    while (this.match(TokenType.COMMA)) items.push(this.parseValue())
    this.expect(TokenType.RPAREN, "expected ) closing IN list")
    return list(items)
  }

  private parseFunctionArgs(): Value {
    this.expect(TokenType.LPAREN, "expected ( starting MATCHES args")
    const args: FunctionArg[] = [this.parseFunctionArg()]
    while (this.match(TokenType.COMMA)) args.push(this.parseFunctionArg())
    this.expect(TokenType.RPAREN, "expected ) closing MATCHES args")
    return fnArgs(args)
  }

  private parseFunctionArg(): FunctionArg {
    const keyTok = this.expect(
      TokenType.IDENT,
      "expected argument name (e.g. count, date, id)",
    )
    const { operator, value } = this.parseOpClause()
    return { key: keyTok.text, operator, value }
  }
}

function parseDateOffset(text: string, column: number): Value {
  const m = /^([-+])(\d+)([dwmy])$/i.exec(text)
  if (!m) {
    throw new ParserError(`invalid date offset '${text}'`, column)
  }
  return dateOffset(
    m[1] as "-" | "+",
    Number(m[2]),
    m[3].toLowerCase() as "d" | "w" | "m" | "y",
  )
}

function isOperatorStart(tok: Token): boolean {
  switch (tok.type) {
    case TokenType.EQ:
    case TokenType.NEQ:
    case TokenType.GT:
    case TokenType.GTE:
    case TokenType.LT:
    case TokenType.LTE:
    case TokenType.IN:
    case TokenType.CONTAINS:
    case TokenType.IS:
    case TokenType.BETWEEN:
    case TokenType.MATCHES:
    case TokenType.NOT:
      return true
    default:
      return false
  }
}
