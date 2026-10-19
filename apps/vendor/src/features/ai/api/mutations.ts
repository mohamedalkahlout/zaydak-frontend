import { gql } from "@apollo/client"

export const VENDOR_AGENT_CHAT = gql`
  mutation VendorAgentChat($input: VendorAgentChatInput!) {
    vendorAgentChat(input: $input) {
      reply
      conversation_id
      tool_events {
        name
        args
        ok
        result
        error
      }
    }
  }
`

export const DELETE_VENDOR_AGENT_CONVERSATION = gql`
  mutation DeleteVendorAgentConversation($id: String!) {
    deleteVendorAgentConversation(id: $id) {
      success
    }
  }
`

export const PIN_VENDOR_AGENT_CONVERSATION = gql`
  mutation PinVendorAgentConversation($id: String!, $pinned: Boolean!) {
    pinVendorAgentConversation(id: $id, pinned: $pinned) {
      success
    }
  }
`

export const RENAME_VENDOR_AGENT_CONVERSATION = gql`
  mutation RenameVendorAgentConversation($id: String!, $title: String!) {
    renameVendorAgentConversation(id: $id, title: $title) {
      success
    }
  }
`

export const BULK_DELETE_VENDOR_AGENT_CONVERSATIONS = gql`
  mutation BulkDeleteVendorAgentConversations($ids: [String!]!) {
    bulkDeleteVendorAgentConversations(ids: $ids) {
      success
      message
    }
  }
`

export const BULK_PIN_VENDOR_AGENT_CONVERSATIONS = gql`
  mutation BulkPinVendorAgentConversations(
    $ids: [String!]!
    $pinned: Boolean!
  ) {
    bulkPinVendorAgentConversations(ids: $ids, pinned: $pinned) {
      success
      message
    }
  }
`

export const SHARE_VENDOR_AGENT_CONVERSATION = gql`
  mutation ShareVendorAgentConversation(
    $id: String!
    $ttl_days: Int
    $pin: String
  ) {
    shareVendorAgentConversation(id: $id, ttl_days: $ttl_days, pin: $pin) {
      token
      url
      expires_at
      has_pin
    }
  }
`

export const UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION = gql`
  mutation UnlockSharedVendorAgentConversation(
    $token: String!
    $pin: String!
  ) {
    unlockSharedVendorAgentConversation(token: $token, pin: $pin) {
      status
      conversation {
        id
        title
        currency
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

export const REVOKE_VENDOR_AGENT_CONVERSATION_SHARE = gql`
  mutation RevokeVendorAgentConversationShare($id: String!) {
    revokeVendorAgentConversationShare(id: $id) {
      success
    }
  }
`

export const RESTORE_VENDOR_AGENT_CONVERSATION = gql`
  mutation RestoreVendorAgentConversation($id: String!) {
    restoreVendorAgentConversation(id: $id) {
      success
    }
  }
`

/**
 * Tell the conversation that the vendor saved what the agent prepared.
 *
 * Deliberately not a chat turn: the sentence is written server-side, so this
 * costs no model call and cannot fail on an overloaded provider. It returns
 * the persisted assistant row, which the panel appends straight into the
 * transcript — so the vendor sees it now, and the model sees it whenever the
 * thread is next loaded.
 */
export const VENDOR_AGENT_SAVE_RECEIPT = gql`
  mutation VendorAgentSaveReceipt($input: VendorAgentSaveReceiptInput!) {
    vendorAgentSaveReceipt(input: $input) {
      id
      role
      content
      parts
      created_at
      tool_events {
        name
        args
        ok
        result
        error
      }
    }
  }
`
