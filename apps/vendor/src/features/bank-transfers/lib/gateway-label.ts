/** Display follows the original payment method for bank transfers throughout their life. */
export function gatewayLabel(gateway: string | null | undefined, translate: (key: string) => string): string {
  switch (gateway) {
    case "BANK_TRANSFER": return translate("bankTransfer")
    case "CASH_ON_DELIVERY": return translate("cod")
    case "STRIPE": return translate("card")
    case "CASH": return translate("cash")
    case "FULL_WALLET_PAYMENT": return translate("wallet")
    // A draft converted with "Payment due later".
    case "INVOICE": return translate("invoice")
    default: return gateway || "—"
  }
}
