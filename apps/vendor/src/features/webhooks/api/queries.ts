import { gql } from "@apollo/client"

export const GET_WEBHOOK_SUBSCRIPTIONS = gql`
  query WebhookSubscriptions {
    webhookSubscriptions {
      success
      data {
        id
        shop_id
        url
        events
        description
        is_active
        created_at
        updated_at
      }
    }
  }
`

export const GET_WEBHOOK_DELIVERIES = gql`
  query WebhookDeliveries($subscription_id: String!, $limit: Int) {
    webhookDeliveries(subscription_id: $subscription_id, limit: $limit) {
      success
      data {
        id
        subscription_id
        event
        payload
        status
        attempts
        response_status
        response_body
        error_message
        next_attempt_at
        succeeded_at
        created_at
      }
    }
  }
`
