# Theme editor — backend integration

**Last updated:** 2026-09-14

This is a proposal only. The Vendor theme editor currently persists through `MockThemeLayoutRepository` (`localStorage`). Do not treat the shapes below as shipped schema.

## Proposed persistence

A shop-scoped page layout, conceptually:

```text
ShopPageLayout
  shopId
  template          // "home" in V1
  draftConfig       // StoreLayoutDocument JSON
  publishedConfig   // StoreLayoutDocument JSON
  draftVersion
  publishedVersion
  publishedAt
```

`StoreLayoutDocument` is instance-ID based:

```text
{
  template, version,
  sections: { [sectionId]: { id, type, disabled, settings } },
  order: string[]
}
```

Do not key the document by section type. Do not store brand hex, shop name, logo, or GraphQL query details in this JSON. Brand remains `Shop.settings.brand`.

## Required future operations

| Intent | Editor call | Suggested GraphQL |
|--------|-------------|-------------------|
| Load the draft the merchant edits | `repository.load(shopSlug, template)` | `getShopThemeLayout(template)` |
| Save without going live | `repository.saveDraft(shopSlug, layout)` | `saveShopThemeDraft(template, layout)` |
| Copy draft onto published | `repository.publish(shopSlug, layout)` | `publishShopTheme(template)` |

Auth: vendor JWT + `X-SHOP`. Permission: `manage_own_shop` (or a dedicated theme permission later). Super-admin may omit `X-SHOP` only if the operation also takes a shop id; this app always sends the header.

Swap by implementing `GraphqlThemeLayoutRepository` and returning it from `getThemeLayoutRepository()`. Tree, inspector, header, and preview chrome should not change.

## Data resolution required later

The layout is merchant intent. The storefront renderer (not this editor) must later resolve:

- collections by `collectionIds`
- products in a collection
- product rails by `source` (`trending`, `most_viewed`, `newest`, `markdowns`, `collection`)
- optional manual product IDs if that setting is added
- hide-when-empty rules (deals need enough markdowns, ticker needs enough collections/tags)

Those thresholds must not be copied into the layout document.

## Preview

`MockThemePreview` is an in-editor canvas. The replacement is `StorefrontIframePreview`:

```text
Vendor editor
  → postMessage LAYOUT_CHANGED | SELECT_SECTION | DEVICE_CHANGED
  → storefront preview route (draft layout, editor chrome off)
  → postMessage SECTION_CLICKED
```

Do not implement iframe messaging until the storefront can render from `publishedConfig` / a draft preview token.

## Persistence today

`MockThemeLayoutRepository` in `apps/vendor/src/features/theme-editor/api/theme-layout-repository.ts`, key `zaydak_theme_layout:{shopSlug}:{template}`, record `{ draft, published }`. Save writes draft only. Publish writes both.

Frontend types live in `apps/vendor/src/features/theme-editor/types.ts`. When a second app needs them, lift that file into a shared package; do not import storefront homepage components into Vendor.
