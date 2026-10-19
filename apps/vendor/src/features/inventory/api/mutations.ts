import { gql } from "@apollo/client"

export const CREATE_INVENTORY_LOCATION = gql`
  mutation CreateInventoryLocation($input: CreateLocationInput!) {
    createInventoryLocation(input: $input) {
      success
      data {
        id
        name
        is_default
        is_active
        fulfills_online_orders
        address_line1
        city
        country
        phone
      }
    }
  }
`

export const UPDATE_INVENTORY_LOCATION = gql`
  mutation UpdateInventoryLocation($input: UpdateLocationInput!) {
    updateInventoryLocation(input: $input) {
      success
      data {
        id
        name
        is_default
        is_active
        fulfills_online_orders
        address_line1
        city
        country
        phone
      }
    }
  }
`

export const DELETE_INVENTORY_LOCATION = gql`
  mutation DeleteInventoryLocation($id: String!) {
    deleteInventoryLocation(id: $id) {
      success
      message
    }
  }
`

export const SET_INVENTORY_AVAILABLE = gql`
  mutation SetInventoryAvailable($input: SetAvailableInput!) {
    setInventoryAvailable(input: $input) {
      success
      message
      data {
        id
        delta
        available_before
        available_after
        reason
        created_at
      }
    }
  }
`

export const ADJUST_INVENTORY = gql`
  mutation AdjustInventory($input: AdjustInventoryInput!) {
    adjustInventory(input: $input) {
      success
      message
      data {
        id
        delta
        available_before
        available_after
        reason
        created_at
      }
    }
  }
`

export const TRANSFER_INVENTORY = gql`
  mutation TransferInventory($input: TransferInventoryInput!) {
    transferInventory(input: $input) {
      success
      message
    }
  }
`

// Shopify inventory-editor: Set to / Adjust by, into a chosen bucket.
export const EDIT_INVENTORY_STOCK = gql`
  mutation EditInventoryStock($input: EditStockInput!) {
    editInventoryStock(input: $input) {
      success
      message
      data {
        id
        delta
        available_before
        available_after
        reason
        created_at
      }
    }
  }
`

// ── Inventory Transfers (multi-step DRAFT → SENT → RECEIVED) ───────────────

export const CREATE_INVENTORY_TRANSFER = gql`
  mutation CreateInventoryTransfer($input: CreateInventoryTransferInput!) {
    createInventoryTransfer(input: $input) {
      success
      message
      data {
        id
        status
      }
    }
  }
`

export const UPDATE_INVENTORY_TRANSFER = gql`
  mutation UpdateInventoryTransfer($input: UpdateInventoryTransferInput!) {
    updateInventoryTransfer(input: $input) {
      success
      message
      data {
        id
        status
      }
    }
  }
`

export const DUPLICATE_INVENTORY_TRANSFER = gql`
  mutation DuplicateInventoryTransfer($id: String!) {
    duplicateInventoryTransfer(id: $id) {
      success
      message
      data {
        id
        status
      }
    }
  }
`

export const DELETE_INVENTORY_TRANSFER = gql`
  mutation DeleteInventoryTransfer($id: String!) {
    deleteInventoryTransfer(id: $id) {
      success
      message
      data {
        id
      }
    }
  }
`

export const MARK_TRANSFER_READY_TO_SHIP = gql`
  mutation MarkTransferReadyToShip($id: String!) {
    markTransferReadyToShip(id: $id) {
      success
      message
      data {
        id
        status
        ready_at
      }
    }
  }
`

export const SEND_INVENTORY_TRANSFER = gql`
  mutation SendInventoryTransfer($id: String!) {
    sendInventoryTransfer(id: $id) {
      success
      message
      data {
        id
        status
        sent_at
      }
    }
  }
`

export const MANAGE_RECEIVED_ITEMS = gql`
  mutation ManageReceivedItems($input: ManageReceivedItemsInput!) {
    manageReceivedItems(input: $input) {
      success
      message
      data {
        id
        status
      }
    }
  }
`

export const MARK_TRANSFER_TRANSFERRED = gql`
  mutation MarkTransferTransferred($id: String!) {
    markTransferTransferred(id: $id) {
      success
      message
      data {
        id
        status
        received_at
      }
    }
  }
`

export const RECEIVE_INVENTORY_TRANSFER = gql`
  mutation ReceiveInventoryTransfer($input: ReceiveInventoryTransferInput!) {
    receiveInventoryTransfer(input: $input) {
      success
      message
      data {
        id
        status
        received_at
      }
    }
  }
`

export const CANCEL_INVENTORY_TRANSFER = gql`
  mutation CancelInventoryTransfer($id: String!) {
    cancelInventoryTransfer(id: $id) {
      success
      message
      data {
        id
        status
        cancelled_at
      }
    }
  }
`

export const ADD_INVENTORY_TRANSFER_COMMENT = gql`
  mutation AddInventoryTransferComment($input: AddTransferCommentInput!) {
    addInventoryTransferComment(input: $input) {
      success
      data {
        id
        action
        new_values
        created_at
        user {
          id
          name
        }
      }
    }
  }
`

// ── Suppliers ────────────────────────────────────────────────────────────────

export const CREATE_SUPPLIER = gql`
  mutation CreateSupplier($input: CreateSupplierInput!) {
    createSupplier(input: $input) {
      success
      message
      data {
        id
        name
      }
    }
  }
`

export const UPDATE_SUPPLIER = gql`
  mutation UpdateSupplier($input: UpdateSupplierInput!) {
    updateSupplier(input: $input) {
      success
      message
      data {
        id
        name
      }
    }
  }
`

export const DELETE_SUPPLIER = gql`
  mutation DeleteSupplier($id: String!) {
    deleteSupplier(id: $id) {
      success
      message
    }
  }
`

// ── Purchase Orders ────────────────────────────────────────────────────────

export const CREATE_PURCHASE_ORDER = gql`
  mutation CreatePurchaseOrder($input: CreatePurchaseOrderInput!) {
    createPurchaseOrder(input: $input) {
      success
      message
      data {
        id
        status
      }
    }
  }
`

export const UPDATE_PURCHASE_ORDER = gql`
  mutation UpdatePurchaseOrder($input: UpdatePurchaseOrderInput!) {
    updatePurchaseOrder(input: $input) {
      success
      message
      data {
        id
        status
      }
    }
  }
`

export const ORDER_PURCHASE_ORDER = gql`
  mutation OrderPurchaseOrder($id: String!) {
    orderPurchaseOrder(id: $id) {
      success
      message
      data {
        id
        status
        ordered_at
      }
    }
  }
`

export const RECEIVE_PURCHASE_ORDER = gql`
  mutation ReceivePurchaseOrder($input: ReceivePurchaseOrderInput!) {
    receivePurchaseOrder(input: $input) {
      success
      message
      data {
        id
        status
        received_at
      }
    }
  }
`

export const CLOSE_PURCHASE_ORDER = gql`
  mutation ClosePurchaseOrder($id: String!) {
    closePurchaseOrder(id: $id) {
      success
      message
      data {
        id
        status
        closed_at
      }
    }
  }
`

export const DELETE_PURCHASE_ORDER = gql`
  mutation DeletePurchaseOrder($id: String!) {
    deletePurchaseOrder(id: $id) {
      success
      message
    }
  }
`
