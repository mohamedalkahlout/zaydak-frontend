import { z } from "zod"

/**
 * Mirrors `AdminCreateShopInput`.
 *
 * The rules are copied from the back-end's class-validator decorators rather
 * than loosened. A rejected slug comes back as a field error on a mutation that
 * has already promoted nothing — but the admin still has to retype the form, so
 * the same constraint is worth failing on before the round trip.
 */

/** The server's slug pattern: lowercase words joined by single hyphens. */
const slug = z
  .string()
  .trim()
  .max(60, "Slug must be at most 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens",
  )
  // Blank is the ordinary case — the server derives the slug from the name.
  .or(z.literal(""))

export const createShopSchema = z.object({
  owner_id: z.string().min(1, "Select an owner"),
  name: z.string().trim().min(1, "Name is required").max(255),
  slug,
  description: z.string().trim().max(10000),
  is_active: z.boolean(),
  is_approved: z.boolean(),
})

export type CreateShopFormValues = z.infer<typeof createShopSchema>
