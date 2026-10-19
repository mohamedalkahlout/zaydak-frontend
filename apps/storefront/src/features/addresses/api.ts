import { gql } from "@/shared/api/generated"

/**
 * Saved delivery addresses.
 *
 * The whole CRUD already existed on the back-end (`AddressesResolver`) for the
 * vendor dashboard's customer screens — this app adds no operation, it just
 * calls them as the customer rather than about them.
 *
 * Two server rules shape how the screens below behave, and both are worth
 * knowing before editing either:
 *
 *  - **`default` is exclusive.** `AddressesService.create`/`update` clear the
 *    flag on every other row of the same customer inside the same call, so the
 *    UI never has to unset the old default itself — and must not try, because
 *    doing it as a second mutation would leave a window with no default at all.
 *  - **Delete is a soft delete** (`deleted_at`), and `myAddresses` filters those
 *    out. An order already placed against a deleted address keeps its own copy
 *    of the blob, so removing one here never rewrites history.
 *
 * `AddressEntry.address` is `JSON`, so the shape inside it is this app's
 * contract rather than the API's — see `lib/address.ts`.
 */

export const ADDRESS_FIELDS = gql(`
  fragment AddressFields on AddressEntry {
    id
    title
    type
    default
    address
  }
`)

export const MY_ADDRESSES = gql(`
  query StorefrontMyAddresses($page: Int, $limit: Int) {
    myAddresses(page: $page, limit: $limit) {
      success
      data {
        ...AddressFields
      }
      meta {
        total
      }
    }
  }
`)

export const CREATE_ADDRESS = gql(`
  mutation StorefrontCreateAddress($input: CreateAddressInput!) {
    createAddress(input: $input) {
      success
      data {
        ...AddressFields
      }
    }
  }
`)

export const UPDATE_ADDRESS = gql(`
  mutation StorefrontUpdateAddress($input: UpdateAddressInput!) {
    updateAddress(input: $input) {
      success
      data {
        ...AddressFields
      }
    }
  }
`)

/**
 * Returns `BaseResponse` — no entry comes back, so unlike the two above this is
 * the one mutation the Apollo cache cannot repaint from its own result. Callers
 * refetch `myAddresses` rather than evicting by hand: the list is a page of at
 * most a dozen rows, and a manual eviction would also have to fix up `meta`.
 */
export const DELETE_ADDRESS = gql(`
  mutation StorefrontDeleteAddress($id: String!) {
    deleteAddress(id: $id) {
      success
      message
    }
  }
`)

/**
 * Expand a Saudi National Address short code into a full postal address.
 *
 * Reached by a CUSTOMER, not a merchant: the server deliberately gates this on
 * a session alone rather than on a shop permission, because the address form
 * where a wrong code costs the most is this one — a receiver address a courier
 * cannot find. It is throttled per caller on the server, since it forwards to
 * the carrier's own endpoint.
 *
 * Nothing is stored. The screen calls it as the customer types so they can see
 * the address they are about to be delivered to.
 */
export const LOOKUP_NATIONAL_ADDRESS = gql(`
  query LookupNationalAddress($input: LookupNationalAddressInput!) {
    lookupNationalAddress(input: $input) {
      success
      data {
        code
        formatted
        # Every part the form turns into an address line. The code is the only
        # thing a customer types, so these ARE the address — not a convenience
        # on top of one they also filled in by hand.
        city
        country
        district
        street
        building_number
        postcode
      }
    }
  }
`)

/** What `LOOKUP_NATIONAL_ADDRESS` answers with. */
export interface LookupNationalAddressResult {
  lookupNationalAddress: {
    success: boolean
    data?: {
      code: string
      formatted: string
      city: string
      country: string
      district?: string | null
      street?: string | null
      building_number?: string | null
      postcode?: string | null
    } | null
  }
}

/** Public registry for Palestine CITY shipping — codes are the matcher key. */
export const PALESTINE_CITIES = gql(`
  query StorefrontPalestineCities {
    palestineCities {
      success
      data {
        code
        country
        name_ar
        name_en
      }
    }
  }
`)

export type PalestineCitiesResult = {
  palestineCities: {
    success: boolean
    data: {
      code: string
      country: string
      name_ar: string
      name_en: string
    }[]
  }
}
