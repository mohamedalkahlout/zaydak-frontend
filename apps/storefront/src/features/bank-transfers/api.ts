import { gql } from "@/shared/api/generated"

export const PAYMENT_OPTIONS = gql(`
  query StorefrontPaymentOptions {
    shopPaymentOptions {
      success
      data {
        available_gateways
        cod_available
        card_available
        bank_transfer_available
      }
    }
  }
`)

export const BANKS = gql(`
  query StorefrontBanks($locale: String) {
    banks(locale: $locale) {
      success
      data { code name swift icon }
    }
  }
`)

export const BANK_ACCOUNT_SNAPSHOT = gql(`
  fragment StorefrontBankAccountSnapshot on BankAccountSnapshot {
    id
    bank_code
    bank_name
    account_holder_name
    account_number
    iban
    swift_code
    currency
    notes
  }
`)

export const SHOP_BANK_ACCOUNTS = gql(`
  query StorefrontShopBankAccounts {
    shopBankAccounts {
      success
      data {
        id
        bank_code
        bank_name
        account_holder_name
        account_number
        iban
        swift_code
        currency
        notes
      }
    }
  }
`)

export const ORDER_BANK_TRANSFERS = gql(`
  query StorefrontOrderBankTransfers($order_id: String!) {
    orderBankTransfers(order_id: $order_id) {
      success
      data {
        id
        status
        bank_account_snapshot { ...StorefrontBankAccountSnapshot }
        amount_due_cents
        claimed_amount_cents
        currency
        sender_name
        transfer_reference
        transferred_at
        created_at
        rejection_reason
        receipt_url
        receipt_original_name
        receipt_purged_at
      }
    }
  }
`)
