import { gql } from "@apollo/client"

const ACCOUNT_FIELDS = gql`
  fragment VendorBankAccountFields on ShopBankAccountEntry {
    id shop_id bank_code bank_name account_holder_name account_number iban
    swift_code currency notes is_active sort_order created_at updated_at
  }
`

const SETTINGS_FIELDS = gql`
  fragment VendorPaymentSettingsFields on ShopPaymentSettings {
    cod_enabled card_enabled bank_transfer_enabled card_available bank_transfer_available
  }
`

export const GET_PAYMENT_SETTINGS = gql`
  query VendorPaymentSettings($locale: String) {
    banks(locale: $locale) { success data { code name swift icon } }
    shopPaymentSettings { success data { ...VendorPaymentSettingsFields } }
    shopBankAccounts(include_inactive: true) { success data { ...VendorBankAccountFields } }
  }
  ${SETTINGS_FIELDS}
  ${ACCOUNT_FIELDS}
`

export const UPDATE_PAYMENT_SETTINGS = gql`
  mutation VendorUpdatePaymentSettings($input: UpdateShopPaymentSettingsInput!) {
    updateShopPaymentSettings(input: $input) { success data { ...VendorPaymentSettingsFields } }
  }
  ${SETTINGS_FIELDS}
`

export const CREATE_BANK_ACCOUNT = gql`
  mutation VendorCreateBankAccount($input: CreateShopBankAccountInput!) {
    createShopBankAccount(input: $input) { success data { ...VendorBankAccountFields } }
  }
  ${ACCOUNT_FIELDS}
`

export const UPDATE_BANK_ACCOUNT = gql`
  mutation VendorUpdateBankAccount($input: UpdateShopBankAccountInput!) {
    updateShopBankAccount(input: $input) { success data { ...VendorBankAccountFields } }
  }
  ${ACCOUNT_FIELDS}
`

export const DELETE_BANK_ACCOUNT = gql`
  mutation VendorDeleteBankAccount($id: String!) {
    deleteShopBankAccount(id: $id) { success data { ...VendorBankAccountFields } }
  }
  ${ACCOUNT_FIELDS}
`

const TRANSFER_FIELDS = gql`
  fragment VendorBankTransferFields on OrderBankTransferEntry {
    id order_id customer_name amount_due_cents claimed_amount_cents currency
    sender_name sender_bank_code transfer_reference transferred_at note
    bank_account_snapshot {
      id bank_code bank_name account_holder_name account_number iban swift_code currency notes
    }
    receipt_mime_type receipt_original_name receipt_url receipt_purged_at
    status rejection_reason reviewed_at created_at can_review
  }
`

export const GET_ORDER_BANK_TRANSFERS = gql`
  query VendorOrderBankTransfers($order_id: String!) {
    orderBankTransfers(order_id: $order_id) { success data { ...VendorBankTransferFields } }
  }
  ${TRANSFER_FIELDS}
`

export const REVIEW_BANK_TRANSFER = gql`
  mutation VendorReviewBankTransfer($input: ReviewBankTransferInput!) {
    reviewBankTransfer(input: $input) { success data { ...VendorBankTransferFields } }
  }
  ${TRANSFER_FIELDS}
`
