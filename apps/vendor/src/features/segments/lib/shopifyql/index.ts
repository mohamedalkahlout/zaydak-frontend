/**
 * ShopifyQL — frontend mirror of the backend's `customer-segments/shopifyql/`.
 *
 * Phase 10E will extract this into a shared package; until then the two
 * copies are kept byte-for-byte identical (apart from the `.js` extensions
 * NestJS requires in its ESM build).
 *
 * Public surface:
 *   - `parseShopifyQL(source)` → AST (throws ParserError)
 *   - `serializeShopifyQL(ast)` → canonical string (round-trippable)
 *   - AST types + constructors (re-exported from ./ast)
 *   - Mutation helpers (./mutate) — the engine for the chip overlay
 */

export * from "./ast"
export { tokenize, LexerError } from "./lexer"
export { parseShopifyQL, ParserError } from "./parser"
export { serializeShopifyQL, serializeValue } from "./serializer"
export { TokenType } from "./tokens"
export type { Token } from "./tokens"
export {
  flattenConditions,
  getTopLogic,
  replaceConditionAt,
  removeConditionAt,
  appendCondition,
  setTopLogic,
  canRenderAsChipStrip,
} from "./mutate"
export type { TopLogic, FlatCondition } from "./mutate"
