import { gql } from "@/shared/api/generated"

/**
 * Integrations console operations.
 *
 * Every one is gated on `manage_integrations` (`integrations.resolver.ts`),
 * which `admin` and `super_admin` carry and no vendor role does. The whole
 * surface is **platform-scoped: no X-SHOP on any of it** — these are the
 * platform's own third-party accounts, and this app sends no header anyway.
 *
 * **No response here contains a credential.** `values` are masked server-side
 * and there is deliberately no reveal operation: a secret that can be read back
 * is one XSS away from being copied. That has a direct consequence for the form
 * — it can never pre-fill a secret input, so a blank secret means "leave it
 * alone" rather than "clear it" (see `provider-card.tsx`).
 */

/**
 * The provider catalog. `fields` is what the form renders from, so adding a
 * provider on the back-end costs this app nothing.
 */
export const INTEGRATION_PROVIDERS = gql(`
  query IntegrationProviders {
    integrationProviders {
      success
      data {
        type
        provider
        name
        name_ar
        description
        description_ar
        is_dev_sink
        fields {
          key
          label
          label_ar
          input_type
          required
          secret
          placeholder
          help
          help_ar
          # Populated for select fields only: the closed set of values, with
          # their labels, so the control never invents a vocabulary of its own.
          options {
            value
            label
            label_ar
          }
        }
      }
    }
  }
`)

/** Every stored config, credentials masked. */
export const INTEGRATION_CONFIGS = gql(`
  query IntegrationConfigs {
    integrationConfigs {
      success
      data {
        id
        type
        provider
        is_enabled
        last_verified_at
        last_verify_error
        updated_at
        values {
          key
          value
          is_secret
        }
      }
    }
  }
`)

/**
 * What each type is actually using right now.
 *
 * The screen leads with this because the most confusing state this feature can
 * produce is "I filled in the form and nothing changed" — which is exactly what
 * a saved-but-not-enabled provider looks like while `.env` still serves.
 * `unusable_reason` is the other half: a row that is saved and enabled but
 * cannot be read, which otherwise looks exactly like nothing being saved.
 * `not_in_use_reason` is the third: a configuration that resolves but that the
 * server does not run on — Storage while `STORAGE_DRIVER` is not `bunnycdn`.
 */
export const INTEGRATION_STATUS = gql(`
  query IntegrationStatus {
    integrationStatus {
      success
      data {
        type
        provider
        source
        is_dev_sink
        unusable_reason
        not_in_use_reason
      }
    }
  }
`)

export const SAVE_INTEGRATION = gql(`
  mutation SaveIntegration($input: SaveIntegrationInput!) {
    saveIntegration(input: $input) {
      success
      message
      data {
        id
        type
        provider
        is_enabled
        last_verified_at
        last_verify_error
      }
    }
  }
`)

export const SET_INTEGRATION_ENABLED = gql(`
  mutation SetIntegrationEnabled($input: SetIntegrationEnabledInput!) {
    setIntegrationEnabled(input: $input) {
      success
      message
      data {
        id
        is_enabled
      }
    }
  }
`)

export const DELETE_INTEGRATION = gql(`
  mutation DeleteIntegration($id: String!) {
    deleteIntegration(id: $id) {
      success
      message
    }
  }
`)

/** Re-check stored credentials against the provider. */
export const VERIFY_INTEGRATION = gql(`
  mutation VerifyIntegration($id: String!) {
    verifyIntegration(id: $id) {
      success
      data {
        ok
        error
      }
    }
  }
`)

/**
 * Push the saved callback origin onto every existing WhatsApp instance.
 *
 * Not part of the generic integration surface, and deliberately so: it lives
 * in the WhatsApp module and is gated on `manage_integrations` alone. It takes
 * no id because it is not about *this* row — it is about every shop session
 * that was paired before the origin was set, none of which registered a
 * webhook and none of which can be fixed by saving this form again.
 */
export const SYNC_WHATSAPP_WEBHOOKS = gql(`
  mutation SyncWhatsAppWebhooks {
    syncWhatsAppWebhooks {
      success
      data {
        updated
        failed
      }
    }
  }
`)

/** Send one real message with a stored config, to a destination the admin names. */
export const SEND_INTEGRATION_TEST = gql(`
  mutation SendIntegrationTest($input: TestIntegrationInput!) {
    sendIntegrationTest(input: $input) {
      success
      message
    }
  }
`)

/** Operator Health Panel for Platform SHIPPING integration */
export const PLATFORM_SHIPPING_HEALTH = gql(`
  query PlatformShippingHealth {
    platformShippingHealth {
      success
      data {
        configured
        provider
        is_enabled
        oto_connected
        national_address_ok
        national_address_sample
        callback_origin
        last_verified_at
        last_verify_error
        details
      }
    }
  }
`)

