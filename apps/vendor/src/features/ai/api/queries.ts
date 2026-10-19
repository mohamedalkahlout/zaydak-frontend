import { gql } from "@apollo/client"

export const VENDOR_AGENT_BRIEFING = gql`
  query VendorAgentBriefing {
    vendorAgentBriefing {
      time_of_day
      orders_today
      revenue_today_cents
      revenue_total_cents
      low_stock_count
      new_customers_today
      out_of_stock_count
      pending_refunds_count
      revenue_change_pct
      orders_change_pct
      customers_change_pct
    }
  }
`

export const VENDOR_AGENT_WEEKLY_INSIGHTS = gql`
  query VendorAgentWeeklyInsights {
    vendorAgentWeeklyInsights {
      revenue_7d_cents
      revenue_prior_7d_cents
      revenue_change_pct
      orders_7d
      orders_prior_7d
      orders_change_pct
      daily {
        day
        revenue_cents
        orders
      }
    }
  }
`

export const VENDOR_AGENT_CONVERSATIONS = gql`
  query VendorAgentConversations($search: String) {
    vendorAgentConversations(search: $search) {
      id
      title
      updated_at
      message_count
      preview
      pinned_at
      is_shared
      share_expires_at
      has_share_pin
    }
  }
`

export const VENDOR_AGENT_ARCHIVED_CONVERSATIONS = gql`
  query VendorAgentArchivedConversations {
    vendorAgentArchivedConversations {
      id
      title
      updated_at
      message_count
      preview
      pinned_at
      is_shared
      share_expires_at
      has_share_pin
    }
  }
`

export const VENDOR_AGENT_CONVERSATION = gql`
  query VendorAgentConversation($id: String!) {
    vendorAgentConversation(id: $id) {
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
`

export const PUBLIC_VENDOR_AGENT_CONVERSATION = gql`
  query PublicVendorAgentConversationByToken($token: String!) {
    publicVendorAgentConversationByToken(token: $token) {
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
