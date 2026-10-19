/**
 * ShopifyQL lexer — frontend mirror of the backend lexer.
 * Kept identical so canonical strings round-trip.
 */

import { KEYWORDS, Token, TokenType } from "./tokens"

export class LexerError extends Error {
  constructor(
    message: string,
    public readonly column: number,
  ) {
    super(`Lexer error at column ${column}: ${message}`)
    this.name = "LexerError"
  }
}

const DATE_OFFSET_UNITS = new Set(["d", "w", "m", "y"])

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  const peek = (offset = 0) => source[pos + offset]
  const isAtEnd = () => pos >= source.length

  while (!isAtEnd()) {
    const start = pos
    const ch = source[pos]

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      pos++
      continue
    }

    if (ch === "(") {
      tokens.push({ type: TokenType.LPAREN, text: "(", start: start + 1 })
      pos++
      continue
    }
    if (ch === ")") {
      tokens.push({ type: TokenType.RPAREN, text: ")", start: start + 1 })
      pos++
      continue
    }
    if (ch === ",") {
      tokens.push({ type: TokenType.COMMA, text: ",", start: start + 1 })
      pos++
      continue
    }

    if (ch === "=") {
      tokens.push({ type: TokenType.EQ, text: "=", start: start + 1 })
      pos++
      continue
    }
    if (ch === "!") {
      if (peek(1) !== "=") {
        throw new LexerError(`expected '=' after '!'`, start + 1)
      }
      tokens.push({ type: TokenType.NEQ, text: "!=", start: start + 1 })
      pos += 2
      continue
    }
    if (ch === ">") {
      if (peek(1) === "=") {
        tokens.push({ type: TokenType.GTE, text: ">=", start: start + 1 })
        pos += 2
      } else {
        tokens.push({ type: TokenType.GT, text: ">", start: start + 1 })
        pos++
      }
      continue
    }
    if (ch === "<") {
      if (peek(1) === "=") {
        tokens.push({ type: TokenType.LTE, text: "<=", start: start + 1 })
        pos += 2
      } else {
        tokens.push({ type: TokenType.LT, text: "<", start: start + 1 })
        pos++
      }
      continue
    }

    if (ch === "'") {
      const { text, value, length } = consumeString(source, pos)
      tokens.push({
        type: TokenType.STRING,
        text,
        value,
        start: start + 1,
      })
      pos += length
      continue
    }

    if ((ch === "-" || ch === "+") && isDigit(peek(1))) {
      const offset = tryConsumeDateOffset(source, pos)
      if (offset) {
        tokens.push({
          type: TokenType.DATE_OFFSET,
          text: offset.text,
          start: start + 1,
        })
        pos += offset.length
        continue
      }
      const n = consumeNumber(source, pos)
      tokens.push({
        type: TokenType.NUMBER,
        text: n.text,
        value: n.value,
        start: start + 1,
      })
      pos += n.length
      continue
    }

    if (isDigit(ch)) {
      const dateLit = tryConsumeDate(source, pos)
      if (dateLit) {
        tokens.push({
          type: TokenType.DATE,
          text: dateLit.text,
          value: dateLit.text,
          start: start + 1,
        })
        pos += dateLit.length
        continue
      }
      const n = consumeNumber(source, pos)
      tokens.push({
        type: TokenType.NUMBER,
        text: n.text,
        value: n.value,
        start: start + 1,
      })
      pos += n.length
      continue
    }

    if (isIdentStart(ch)) {
      const ident = consumeIdentifier(source, pos)
      const upper = ident.text.toUpperCase()
      const keywordType = KEYWORDS[upper]
      if (keywordType) {
        const token: Token = {
          type: keywordType,
          text: ident.text,
          start: start + 1,
        }
        if (keywordType === TokenType.TRUE) token.value = true
        if (keywordType === TokenType.FALSE) token.value = false
        tokens.push(token)
      } else {
        tokens.push({
          type: TokenType.IDENT,
          text: ident.text,
          value: ident.text,
          start: start + 1,
        })
      }
      pos += ident.length
      continue
    }

    throw new LexerError(`unexpected character '${ch}'`, start + 1)
  }

  tokens.push({ type: TokenType.EOF, text: "", start: pos + 1 })
  return tokens
}

function consumeString(
  source: string,
  start: number,
): { text: string; value: string; length: number } {
  let pos = start + 1
  let value = ""
  while (pos < source.length) {
    const ch = source[pos]
    if (ch === "'") {
      if (source[pos + 1] === "'") {
        value += "'"
        pos += 2
        continue
      }
      const length = pos + 1 - start
      return { text: source.slice(start, pos + 1), value, length }
    }
    value += ch
    pos++
  }
  throw new LexerError("unterminated string literal", start + 1)
}

function consumeNumber(
  source: string,
  start: number,
): { text: string; value: number; length: number } {
  let pos = start
  if (source[pos] === "-" || source[pos] === "+") pos++
  while (pos < source.length && isDigit(source[pos])) pos++
  if (source[pos] === ".") {
    pos++
    while (pos < source.length && isDigit(source[pos])) pos++
  }
  const text = source.slice(start, pos)
  const value = Number(text)
  if (!Number.isFinite(value)) {
    throw new LexerError(`invalid number '${text}'`, start + 1)
  }
  return { text, value, length: pos - start }
}

function tryConsumeDate(
  source: string,
  start: number,
): { text: string; length: number } | null {
  const re = /^\d{4}-\d{2}-\d{2}/
  const slice = source.slice(start, start + 10)
  if (!re.test(slice)) return null
  const after = source[start + 10]
  if (after && isDigit(after)) return null
  if (Number.isNaN(Date.parse(`${slice}T00:00:00.000Z`))) return null
  return { text: slice, length: 10 }
}

function tryConsumeDateOffset(
  source: string,
  start: number,
): { text: string; length: number } | null {
  let pos = start + 1
  while (pos < source.length && isDigit(source[pos])) pos++
  if (pos === start + 1) return null
  const unit = source[pos]?.toLowerCase()
  if (!unit || !DATE_OFFSET_UNITS.has(unit)) return null
  const after = source[pos + 1]
  if (after && isIdentPart(after)) return null
  const length = pos + 1 - start
  return { text: source.slice(start, start + length), length }
}

function consumeIdentifier(
  source: string,
  start: number,
): { text: string; length: number } {
  let pos = start
  while (pos < source.length && isIdentPart(source[pos])) pos++
  while (
    source[pos] === "." &&
    pos + 1 < source.length &&
    isIdentStart(source[pos + 1])
  ) {
    pos++
    while (pos < source.length && isIdentPart(source[pos])) pos++
  }
  return { text: source.slice(start, pos), length: pos - start }
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9"
}

function isIdentStart(ch: string | undefined): boolean {
  return (
    ch !== undefined &&
    ((ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      ch === "_")
  )
}

function isIdentPart(ch: string | undefined): boolean {
  return isIdentStart(ch) || isDigit(ch)
}
