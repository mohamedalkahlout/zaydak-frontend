/**
 * Token types emitted by the ShopifyQL lexer.
 *
 * Mirrored from `back-end/src/customer-segments/shopifyql/tokens.ts` so the
 * shape stays identical on both sides of the wire. Phase 10E will extract
 * this whole `shopifyql/` directory into a shared package.
 */

export enum TokenType {
  IDENT = "IDENT",
  NUMBER = "NUMBER",
  STRING = "STRING",
  DATE = "DATE",
  DATE_OFFSET = "DATE_OFFSET",

  TRUE = "TRUE",
  FALSE = "FALSE",

  EQ = "EQ",
  NEQ = "NEQ",
  GT = "GT",
  GTE = "GTE",
  LT = "LT",
  LTE = "LTE",

  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  IN = "IN",
  IS = "IS",
  NULL = "NULL",
  BETWEEN = "BETWEEN",
  CONTAINS = "CONTAINS",
  MATCHES = "MATCHES",
  TODAY = "TODAY",
  YESTERDAY = "YESTERDAY",

  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  COMMA = "COMMA",

  EOF = "EOF",
}

export interface Token {
  type: TokenType
  text: string
  value?: string | number | boolean
  start: number
}

export const KEYWORDS: Record<string, TokenType> = {
  AND: TokenType.AND,
  OR: TokenType.OR,
  NOT: TokenType.NOT,
  IN: TokenType.IN,
  IS: TokenType.IS,
  NULL: TokenType.NULL,
  BETWEEN: TokenType.BETWEEN,
  CONTAINS: TokenType.CONTAINS,
  MATCHES: TokenType.MATCHES,
  TRUE: TokenType.TRUE,
  FALSE: TokenType.FALSE,
  TODAY: TokenType.TODAY,
  YESTERDAY: TokenType.YESTERDAY,
}
