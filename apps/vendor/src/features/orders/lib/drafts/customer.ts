import { hasValidationCode } from "@/shared/lib/validation-errors"

/**
 * The message key for the server's `invalid_customer` refusal of a draft's
 * `customer_id`, or null when the error is about something else.
 *
 * `createDraftOrder` and `updateDraftOrder` accept only a live customer of
 * the shop. The picker sends a contact's linked customer, so from this form
 * the refusal means the customer was removed after it was linked (or, rarer,
 * the contact was deleted while the picker was open). Removing a customer
 * does not unlink its contacts, so picking the same contact again fails the
 * same way; the message says to remove the customer or pick
 * another instead of showing the server's "Validation failed".
 *
 * Abandoned carts' Create order calls it too. It sends the cart's own
 * customer, which the list still shows after that customer is soft-deleted
 * (the 2026-09-26 migration carried deleted accounts over as deleted
 * customers). No draft exists there and there is no picker, so that screen
 * uses its own copy rather than the returned key.
 */
export function draftCustomerErrorKey(
  err: unknown,
): "customerErrorDeleted" | null {
  return hasValidationCode(err, "invalid_customer")
    ? "customerErrorDeleted"
    : null
}

/**
 * The message key for a refused shipping quote in the draft's shipping
 * dialog, or null when there is no error.
 *
 * `verifyCheckout` checks a named customer on every quote, while
 * `updateDraftOrder` checks only a changed one and `convertDraftOrder` maps a
 * CRM contact id (what drafts held before 2026-09-22) to its linked customer.
 * So a draft can save and convert while every quote for it is refused as
 * `invalid_customer`, and the dialog is the only place the merchant sees it.
 * The copy differs from `customerErrorDeleted` because such a draft does save.
 * Any other refusal gets the generic key rather than "no rate matches".
 */
export function draftQuoteErrorKey(
  err: unknown,
): "shippingQuoteCustomerInvalid" | "shippingQuoteFailed" | null {
  if (!err) return null
  return draftCustomerErrorKey(err)
    ? "shippingQuoteCustomerInvalid"
    : "shippingQuoteFailed"
}
