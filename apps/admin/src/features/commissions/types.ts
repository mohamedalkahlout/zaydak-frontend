import type { AdminCommissionsQuery } from "@/shared/api/generated/graphql"

/** One row of the `commissions` list, as selected by the `AdminCommissions` query. */
export type CommissionRow = AdminCommissionsQuery["commissions"]["data"][number]
