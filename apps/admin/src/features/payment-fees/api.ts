import { gql } from "@/shared/api/generated"

/**
 * The platform's processor-fee schedule: what each payment method costs the
 * platform per order.
 *
 * Both operations are gated on `manage_all_shops` alone
 * (payment-gateway-fees.resolver.ts), i.e. admin + super_admin, and carry no
 * shop scope: a fee saved here applies to every shop.
 *
 * Units: the percentage crosses the API as basis points and the fixed part and
 * the cap as integer cents, the units the database stores. The form takes a
 * percent and major units; `toUpsertInput` (validations.ts) converts at the
 * network boundary, never inside a render.
 *
 * `gateways` is the set the mutation accepts, sent by the server so the form's
 * picker cannot offer a method the API would refuse.
 */

export const PAYMENT_GATEWAY_FEES = gql(`
  query AdminPaymentGatewayFees {
    paymentGatewayFees {
      success
      data {
        id
        gateway
        currency
        fee_bps
        fee_fixed_cents
        fee_cap_cents
        active
        updated_at
      }
      gateways
      shop_override_count
    }
  }
`)

export const UPSERT_PAYMENT_GATEWAY_FEE = gql(`
  mutation AdminUpsertPaymentGatewayFee($input: UpsertPaymentGatewayFeeInput!) {
    upsertPaymentGatewayFee(input: $input) {
      success
      data {
        id
      }
    }
  }
`)
