import { gql } from "@apollo/client"
import { useMutation, useQuery } from "@apollo/client/react"
import {
  PUBLIC_VENDOR_AGENT_CONVERSATION,
  UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION,
} from "@/features/ai/api"
import {
  isUnknownFieldError,
  withLegacyFallback,
} from "@/shared/lib/apollo/legacy-fallback"
import type { VendorAgentConversationDetail } from "./types"

/**
 * TRANSITIONAL — delete the two legacy documents and the fallbacks below once
 * every API this dashboard can talk to returns `currency` on
 * `VendorAgentConversationEntry`; the hooks then read the current documents
 * alone.
 *
 * The share page selects `conversation { currency }` so it can price a shared
 * thread in the shop's own currency. This app deploys minutes after a push
 * and the API image is rebuilt on its own schedule, and an API without the
 * field refuses the WHOLE operation at validation — so every share link would
 * read "not available" until the API caught up. A lookup or an unlock refused
 * for an unknown field is therefore sent again as it was before the field
 * existed, and the view falls back to the currency the thread itself names
 * (`sharedConversationCurrency`). See `shared/lib/apollo/legacy-fallback.ts`.
 *
 * The retry is safe on the unlock too: a request that fails validation is
 * never executed, so it spent no PIN attempt and no throttle slot.
 */

/** `PUBLIC_VENDOR_AGENT_CONVERSATION` exactly as it was before `currency`. */
export const PUBLIC_VENDOR_AGENT_CONVERSATION_LEGACY = gql`
  query PublicVendorAgentConversationByTokenLegacy($token: String!) {
    publicVendorAgentConversationByToken(token: $token) {
      status
      conversation {
        id
        title
        created_at
        updated_at
        messages {
          id
          role
          content
          created_at
          tool_events {
            name
            args
            ok
            result
            error
          }
          parts
        }
      }
    }
  }
`

/** `UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION` exactly as it was before
 * `currency`. */
export const UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION_LEGACY = gql`
  mutation UnlockSharedVendorAgentConversationLegacy(
    $token: String!
    $pin: String!
  ) {
    unlockSharedVendorAgentConversation(token: $token, pin: $pin) {
      status
      conversation {
        id
        title
        created_at
        updated_at
        messages {
          id
          role
          content
          created_at
          tool_events {
            name
            args
            ok
            result
            error
          }
          parts
        }
      }
    }
  }
`

/** What a share token resolves to. */
export interface SharedConversationLookup {
  status: "ok" | "pin_required" | "not_found"
  conversation: VendorAgentConversationDetail | null
}

interface LookupResponse {
  publicVendorAgentConversationByToken: SharedConversationLookup | null
}

interface UnlockResponse {
  unlockSharedVendorAgentConversation: {
    status: "ok" | "not_found"
    conversation: VendorAgentConversationDetail | null
  }
}

/**
 * The public lookup behind `/share/[token]`. An API without `currency`
 * refuses the current document; the legacy one then runs in its place, and
 * the caller cannot tell which answered except that `currency` is absent.
 */
export function useSharedConversationLookup(token: string) {
  const current = useQuery<LookupResponse>(PUBLIC_VENDOR_AGENT_CONVERSATION, {
    variables: { token },
  })
  const refused = isUnknownFieldError(current.error)
  const legacy = useQuery<LookupResponse>(
    PUBLIC_VENDOR_AGENT_CONVERSATION_LEGACY,
    { variables: { token }, skip: !refused },
  )

  if (!refused) {
    return {
      lookup: current.data?.publicVendorAgentConversationByToken ?? null,
      loading: current.loading,
      error: current.error,
    }
  }
  return {
    lookup: legacy.data?.publicVendorAgentConversationByToken ?? null,
    // Still loading until the retry has answered one way or the other: the
    // render that flips `skip` must not read as "no such conversation".
    loading: legacy.loading || (!legacy.data && !legacy.error),
    error: legacy.error,
  }
}

/** The PIN unlock, with the same fallback. Resolves to the conversation, or
 * null for a wrong PIN or a dead link. */
export function useUnlockSharedConversation() {
  const [unlock, { loading }] = useMutation<UnlockResponse>(
    UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION,
  )
  const [unlockLegacy, { loading: legacyLoading }] =
    useMutation<UnlockResponse>(UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION_LEGACY)

  const run = async (
    token: string,
    pin: string,
  ): Promise<VendorAgentConversationDetail | null> => {
    const variables = { token, pin }
    const { data } = await withLegacyFallback(
      () => unlock({ variables }),
      () => unlockLegacy({ variables }),
    )
    const result = data?.unlockSharedVendorAgentConversation
    return result?.status === "ok" ? (result.conversation ?? null) : null
  }

  return [run, { loading: loading || legacyLoading }] as const
}
