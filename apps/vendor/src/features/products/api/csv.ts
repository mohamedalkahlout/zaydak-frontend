import { gql } from "@apollo/client"

/**
 * Bulk catalogue transfer. Both operations need `MANAGE_OWN_SHOP` (or
 * `MANAGE_ALL_SHOPS`) and are scoped by `X-SHOP`. Neither is gated on a plan
 * capability — moving your own catalogue in and out is not something a shop
 * has to pay for.
 *
 * The import is called **twice** for one merchant action: once with
 * `dry_run: true` to render the preview step, then again with the same file
 * and the same options to commit. That is deliberate — the preview is the
 * importer's own report rather than a second parser in the browser, so what
 * the merchant approves is what runs.
 */
export const IMPORT_PRODUCTS_CSV = gql`
  mutation ImportProductsCsv($input: ImportProductsCsvInput!) {
    importProductsCsv(input: $input) {
      success
      total_rows
      products
      skus
      images
      created
      updated
      skipped
      errors
      dry_run
      unmapped_headers
      preview {
        title
        description
        status
        product_type
        category
        brand
        image_url
        variants {
          title
          sku
          weight_grams
          price_cents
        }
      }
      rows {
        row_number
        slug
        action
        product_id
        variants
        errors
      }
    }
  }
`

export const EXPORT_PRODUCTS_CSV = gql`
  mutation ExportProductsCsv($input: ExportProductsCsvInput) {
    exportProductsCsv(input: $input) {
      success
      csv
    }
  }
`

/** One product's outcome. `row_number` is the first CSV line it came from. */
export interface CsvImportRow {
  row_number: number
  slug?: string | null
  action: "create" | "update" | "skip"
  product_id?: string | null
  variants?: number | null
  errors?: { field: string; message: string }[] | null
}

export interface CsvImportPreview {
  title: string
  description?: string | null
  status: string
  product_type: string
  category?: string | null
  brand?: string | null
  image_url?: string | null
  variants: {
    title: string
    sku?: string | null
    weight_grams?: number | null
    price_cents?: number | null
  }[]
}

export interface CsvImportResult {
  success: boolean
  total_rows: number
  products: number
  skus: number
  images: number
  created: number
  updated: number
  skipped: number
  errors: number
  dry_run: boolean
  unmapped_headers: string[]
  preview?: CsvImportPreview | null
  rows: CsvImportRow[]
}

export interface ImportProductsCsvData {
  importProductsCsv: CsvImportResult
}

export interface ExportProductsCsvData {
  exportProductsCsv: { success: boolean; csv: string }
}
