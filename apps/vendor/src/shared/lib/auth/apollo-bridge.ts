/**
 * Bridge between non-React auth code (apollo error link, session helpers)
 * and the React-scoped Apollo client.
 *
 * The TokenRefreshProvider registers a "clear cache" callback once it has
 * the client in scope; `forceLogout` calls it before redirecting so the
 * previous user's data can't be flashed if a stale render fires between
 * `clearAuthSession()` and the hard navigation.
 */

import type { ApolloClient } from "@apollo/client"

type ClearCacheFn = () => Promise<void>

let impl: ClearCacheFn | null = null

export function registerClearApolloCache(fn: ClearCacheFn | null) {
  impl = fn
}

export async function clearApolloCache(): Promise<void> {
  if (!impl) return
  try {
    await impl()
  } catch {
    // clearStore rejects if no active queries; safe to ignore.
  }
}

/**
 * The client itself, for non-React callers that need to run an operation.
 *
 * Second consumer of the same bridge, and it exists for the same reason the
 * first one does: something outside the React tree needs the client the tree
 * owns. Here it is `runAiEditorAction` — the rich-text editor's AI actions,
 * called from Tiptap toolbar components rather than from a hook, and reaching a
 * GraphQL mutation now that the transformation moved off a `fetch` to a
 * same-origin Next.js route.
 *
 * **Passing the client in as an argument would have been cleaner and was not
 * available.** Its callers (`ai-menu.tsx`, `ai-ask-button.tsx`) are upstream
 * Tiptap scaffold, carried on an explicit exemption list in
 * `eslint.config.mjs` because we do not maintain them and the next sync
 * overwrites local edits. Keeping `runAiEditorAction`'s signature unchanged is
 * what keeps this change out of those files.
 */
let client: ApolloClient | null = null

export function registerApolloClient(next: ApolloClient | null) {
  client = next
}

/**
 * Null before the provider mounts. Callers must handle that rather than
 * assert — a toolbar button pressed during the first paint is rare but real,
 * and an unhandled null here would surface as a crash inside the editor.
 */
export function getApolloClient(): ApolloClient | null {
  return client
}
