import { describe, expect, it } from "vitest"

import {
  applyNationalAddress,
  clearResolved,
  EMPTY_ADDRESS,
  formatAddressLines,
  isAddressComplete,
  isAddressType,
  readAddress,
  sameAddress,
} from "../address"

describe("readAddress", () => {
  it("reads the shape this app writes", () => {
    expect(
      readAddress({
        street_address: "1 High St",
        city: "Riyadh",
        state: "Riyadh",
        zip: "12345",
        country: "SA",
      }),
    ).toEqual({
      street_address: "1 High St",
      city_code: "",
      city: "Riyadh",
      state: "Riyadh",
      zip: "12345",
      country: "SA",
      // Absent in, empty out — the field is optional and its absence must not
      // read as "unset by mistake".
      national_address_code: "",
      phone: "",
    })
  })

  it("reads the national address code, whatever it was written as", () => {
    // The blob has no schema on the server, so a row written by a different
    // path may carry the carrier's own spelling.
    expect(readAddress({ short_address_code: "rguc8214" }).national_address_code).toBe(
      "RGUC8214",
    )
    expect(readAddress({ shortAddressCode: "RHOD3474" }).national_address_code).toBe(
      "RHOD3474",
    )
  })

  it("accepts the legacy key names still in the database", () => {
    // `AddressEntry.address` is JSON with no enforced shape; rows written
    // before this app existed use `street` / `postal_code`, and dropping them
    // would show an empty form beside an address the customer can see saved.
    expect(
      readAddress({ street: "1 High St", town: "Jeddah", postal_code: "99", country_code: "SA" }),
    ).toMatchObject({
      street_address: "1 High St",
      city: "Jeddah",
      zip: "99",
      country: "SA",
    })
  })

  it("prefers the canonical key when both are present", () => {
    expect(
      readAddress({ street_address: "new", street: "old" }).street_address,
    ).toBe("new")
  })

  it("returns an empty address for anything unreadable", () => {
    expect(readAddress(null)).toEqual(EMPTY_ADDRESS)
    expect(readAddress("1 High St")).toEqual(EMPTY_ADDRESS)
    expect(readAddress(undefined)).toEqual(EMPTY_ADDRESS)
  })

  it("skips a blank value rather than treating it as present", () => {
    expect(readAddress({ street_address: "   ", street: "1 High St" }).street_address).toBe(
      "1 High St",
    )
  })

  it("reads phone number from address blob if present", () => {
    expect(readAddress({ phone: "0501234567" }).phone).toBe("0501234567")
    expect(readAddress({ mobile: "+966501234567" }).phone).toBe("+966501234567")
  })
})

describe("isAddressComplete", () => {
  // A resolved address: the code the customer typed, and what the registry
  // filled in behind it. Nothing here was typed except the code.
  const full = {
    national_address_code: "RGUC8214",
    city_code: "",
    street_address: "8214, Wadi Samael, East Umm Al Hamam",
    city: "Riyadh",
    state: "",
    zip: "12325",
    country: "SA",
    phone: "",
  }

  it("needs a code AND what it resolved to", () => {
    expect(isAddressComplete(full)).toBe(true)
  })

  it("accepts valid phone numbers", () => {
    expect(isAddressComplete({ ...full, phone: "+966501234567" })).toBe(true)
    expect(isAddressComplete({ ...full, phone: "0501234567" })).toBe(true)
  })

  it("rejects invalid phone numbers", () => {
    expect(isAddressComplete({ ...full, phone: "invalid-phone" })).toBe(false)
  })

  it("is incomplete with a code that has not resolved yet", () => {
    // The shape is right and the registry has not answered. Checking out here
    // would price the order against a destination nobody has confirmed.
    expect(
      isAddressComplete({ ...full, city: "", country: "", zip: "" }),
    ).toBe(false)
  })

  it("is complete with manual address entry (no code) when street, city, and country are present", () => {
    expect(isAddressComplete({ ...full, national_address_code: "" })).toBe(true)
  })

  it("is incomplete with manual entry if street_address is missing", () => {
    expect(
      isAddressComplete({ ...full, national_address_code: "", street_address: "" }),
    ).toBe(false)
  })

  it("rejects a code of the wrong shape", () => {
    expect(isAddressComplete({ ...full, national_address_code: "RGU821" })).toBe(
      false,
    )
    expect(
      isAddressComplete({ ...full, national_address_code: "12345678" }),
    ).toBe(false)
  })

  it("treats an empty state or postcode as fine", () => {
    // The registry does not return every part for every address.
    expect(isAddressComplete({ ...full, state: "", zip: "" })).toBe(true)
  })

  it("is incomplete when a required field is only whitespace", () => {
    expect(isAddressComplete({ ...full, city: "   " })).toBe(false)
  })

  it("requires city_code for Palestine destinations", () => {
    expect(
      isAddressComplete({
        ...full,
        national_address_code: "",
        country: "PS",
        city: "Gaza",
        city_code: "",
        street_address: "Street 1",
      }),
    ).toBe(false)
    expect(
      isAddressComplete({
        ...full,
        national_address_code: "",
        country: "PS",
        city: "Gaza",
        city_code: "PS-GZA",
        street_address: "Street 1",
      }),
    ).toBe(true)
  })
})

describe("applyNationalAddress", () => {
  it("composes a street line from the parts, not the formatted one-liner", () => {
    // `formatted` already contains the city, postcode and country. Sending it
    // as the street line hands the carrier the same facts twice, once in a
    // field meant for something else.
    const next = applyNationalAddress(
      { ...EMPTY_ADDRESS, national_address_code: "RGUC8214" },
      {
        city: "Riyadh",
        country: "SA",
        formatted: "8214, Wadi Samael, 4593, East Umm Al Hamam, 12325, Riyadh",
        building_number: "8214",
        street: "Wadi Samael",
        district: "East Umm Al Hamam",
        postcode: "12325",
      },
    )

    expect(next.street_address).toBe("8214, Wadi Samael, East Umm Al Hamam")
    expect(next.city).toBe("Riyadh")
    expect(next.country).toBe("SA")
    expect(next.zip).toBe("12325")
    expect(next.national_address_code).toBe("RGUC8214")
  })

  it("falls back to the formatted line when no part came back", () => {
    const next = applyNationalAddress(EMPTY_ADDRESS, {
      city: "Jeddah",
      country: "SA",
      formatted: "Somewhere in Jeddah",
    })

    expect(next.street_address).toBe("Somewhere in Jeddah")
  })
})

describe("clearResolved", () => {
  it("drops everything the previous code resolved to, keeping the code", () => {
    // A corrected code that resolves to nothing must not keep the old city —
    // that is an order priced and shipped to a different address entirely.
    const stale = {
      national_address_code: "ABCD1234",
      city_code: "",
      street_address: "8214, Wadi Samael",
      city: "Riyadh",
      state: "",
      zip: "12325",
      country: "SA",
    }

    expect(clearResolved(stale)).toEqual({
      national_address_code: "ABCD1234",
      city_code: "",
      street_address: "",
      city: "",
      state: "",
      zip: "",
      country: "",
    })
  })
})

describe("formatAddressLines", () => {
  it("groups city, state and postcode onto one locality line", () => {
    expect(
      formatAddressLines({
        national_address_code: "",
        city_code: "",
        street_address: "1 High St",
        city: "Riyadh",
        state: "Riyadh",
        zip: "12345",
        country: "SA",
      }),
    ).toEqual(["1 High St", "Riyadh, Riyadh, 12345", "SA"])
  })

  it("drops the optional fields rather than printing blanks", () => {
    // `state` and `zip` are optional in `addressSchema` because plenty of
    // countries have neither. A card with a stray empty line — or a locality
    // reading "Doha, , " — reads as a half-saved address.
    expect(
      formatAddressLines({
        national_address_code: "",
        city_code: "",
        street_address: "12 Corniche",
        city: "Doha",
        state: "",
        zip: "",
        country: "QA",
      }),
    ).toEqual(["12 Corniche", "Doha", "QA"])
  })

  it("returns nothing at all for an empty address", () => {
    expect(formatAddressLines(EMPTY_ADDRESS)).toEqual([])
  })
})

describe("sameAddress", () => {
  const saved = {
    street_address: "1 High St",
    city_code: "",
    city: "Riyadh",
    state: "",
    zip: "",
    country: "SA",
    national_address_code: "",
  }

  it("matches a saved address against the copy held in the checkout form", () => {
    // The picker tracks selection by value, not by id — the form holds its own
    // copy of whichever card was clicked, so identity is gone immediately.
    expect(sameAddress(saved, { ...saved })).toBe(true)
  })

  it("ignores whitespace the customer did not mean to add", () => {
    expect(sameAddress(saved, { ...saved, city: "  Riyadh " })).toBe(true)
  })

  it("survives an address saved before a field existed", () => {
    // Addresses live in a JSON column with no schema, so a key added later is
    // simply absent on older rows — comparing must not throw on them.
    const legacy = { ...saved } as Record<string, string>
    delete legacy.national_address_code
    expect(sameAddress(saved, legacy as typeof saved)).toBe(true)
  })

  it("stops matching as soon as a character is edited", () => {
    // This is what makes the card visually deselect mid-edit: what ships is
    // what is in the form, so it must stop claiming to be the saved address.
    expect(sameAddress(saved, { ...saved, street_address: "2 High St" })).toBe(false)
  })
})

describe("isAddressType", () => {
  it("accepts only what CreateAddressInput's @IsIn allows", () => {
    expect(isAddressType("shipping")).toBe(true)
    expect(isAddressType("billing")).toBe(true)
    // A row written by another surface could carry anything; normalising beats
    // sending it back to be rejected with a 422.
    expect(isAddressType("home")).toBe(false)
    expect(isAddressType(undefined)).toBe(false)
  })
})
