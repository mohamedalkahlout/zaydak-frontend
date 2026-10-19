import { gql } from "@apollo/client"

export const CREATE_WEBHOOK_SUBSCRIPTION = gql`
  mutation CreateWebhookSubscription($input: CreateWebhookSubscriptionInput!) {
    createWebhookSubscription(input: $input) {
      success
      data {
        id
        url
        events
        description
        is_active
        secret
      }
    }
  }
`

export const UPDATE_WEBHOOK_SUBSCRIPTION = gql`
  mutation UpdateWebhookSubscription($input: UpdateWebhookSubscriptionInput!) {
    updateWebhookSubscription(input: $input) {
      success
      data {
        id
        url
        events
        description
        is_active
      }
    }
  }
`

export const ROTATE_WEBHOOK_SECRET = gql`
  mutation RotateWebhookSecret($id: String!) {
    rotateWebhookSecret(id: $id) {
      success
      message
      secret
    }
  }
`

export const DELETE_WEBHOOK_SUBSCRIPTION = gql`
  mutation DeleteWebhookSubscription($id: String!) {
    deleteWebhookSubscription(id: $id) {
      success
      message
    }
  }
`

export const SEND_TEST_WEBHOOK = gql`
  mutation SendTestWebhook($id: String!) {
    sendTestWebhook(id: $id) {
      success
      message
    }
  }
`
