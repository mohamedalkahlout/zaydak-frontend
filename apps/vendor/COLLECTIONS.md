# COLLECTIONS — دليل الفرونت الكامل

> **آخر تحديث:** 2026-04-22
> **الـ module:** [src/collections/](../src/collections/)
> **الـ GraphQL schema:** [src/schema.gql](../src/schema.gql) (ابحث عن `Collection`, `CollectionType`)
> **مرجع الـ backend:** [PRODUCTS.md §16.3](./PRODUCTS.md#163-collection-manual--automated)

> ⚠️ **تحديث 2026-04-22 — نظام Category القديم محذوف:** الـ legacy `Category` model + pivots (`CategoryProduct`, `CouponCategory`, `CouponBuyCategory`, `CouponGetCategory`) تم حذفهم نهائياً. النظام الجديد قائم على طبقتين فقط:
>
> - **SystemCategory** (Google taxonomy عالمي، read-only، flat FK على Product) — "شو صنف المنتج؟"
> - **Collection** (هاي الوثيقة — per-shop، flat بدون parent/child) — "كيف نعرضه؟"
>
> الـ Coupon scope هاجر من `category_ids` إلى `system_category_ids`. إذا عندك FE code بيستدعي endpoints القديمة (`categories`, `createCategory`, ...) — هي محذوفة، استبدلها بـ `systemCategories*` للتصنيف أو `collections*` للـ curation.

---

## 📌 الفكرة بسطر

**Collection = طريقة العرض (curation).** vendor يحدّد مجموعة منتجات تظهر مع بعض على الستوفرنت — إما **يدوياً** (MANUAL) أو **بقواعد ذكية** (AUTOMATED).

مش نفس الـ **SystemCategory**:

| | **SystemCategory** | **Collection** |
|---|---|---|
| المُلكية | global، seed من Google Taxonomy | vendor-scoped (shop_id) |
| التعديل | read-only للـ vendor | vendor يصنع/يعدّل/يحذف |
| الدور | "شو هاد المنتج؟" (تصنيف) | "كيف نعرضه؟" (تسويق) |
| مثال | `Electronics > Computers > Laptops` | `"عروض الصيف"`, `"لابتوبات أقل من 1000$"` |

---

## 🏷️ الأنواع (CollectionType)

```graphql
enum CollectionType { MANUAL AUTOMATED }
```

### MANUAL (الافتراضي)

- الـ vendor يختار المنتجات يدوياً عبر `attachProductToCollection` / `detachProductFromCollection`.
- مثال استخدام: *"Staff Picks"*, *"New Arrivals (يدوية)"*, *"Gift Ideas"*.
- الـ FE: drag & drop لترتيب المنتجات + search لإضافة منتج جديد.

### AUTOMATED

- القواعد (`rules` JSON) تحدد المنتجات تلقائياً.
- أي منتج ينطبق عليه الـ rules → بيدخل الـ collection أوتوماتيكياً.
- الـ vendor **ما يقدر يضيف/يحذف يدوياً** — رح يرجع `COLLECTION_MANUAL_ONLY_ACTION`.
- مثال: *"Laptops under $1000"*, *"Apple products"*, *"Clothing size M & price < 50"*.
- الـ FE: rule builder UI (زي Zapier / Shopify Smart Collections).

---

## 🔑 الـ GraphQL API Reference

### Queries (public — أي زائر)

> `X-SHOP` header **إلزامي** (الـ `RequireShopGuard` يرفض بدونه).

```graphql
# قائمة كل الـ collections للمتجر (paginated)
query Collections($page: Int, $limit: Int) {
  collections(page: $page, limit: $limit) {
    success
    data {
      id
      shop_id
      type                # MANUAL | AUTOMATED
      name                # { en: "...", ar: "..." }
      slug                # "summer-sale"
      image               # { url, alt }
      description         # { en, ar }
      sort_order
      rules               # JSON — only for AUTOMATED
      rules_version       # bumps on every rules change
      product_count       # عدد المنتجات الحالية
      created_at
      updated_at
    }
    meta { total page total_pages }
  }
}

# collection واحد بالـ id
query Collection($id: String!) {
  collection(id: $id) { success data { ... } }
}
```

### Mutations (vendor only — JWT + `MANAGE_OWN_SHOP`)

```graphql
createCollection(input: CreateCollectionInput!): CollectionResponse
updateCollection(input: UpdateCollectionInput!): CollectionResponse
deleteCollection(id: String!): BaseResponse                       # soft delete
attachProductToCollection(collection_id, product_id): CollectionResponse  # MANUAL فقط
detachProductFromCollection(collection_id, product_id): CollectionResponse
```

### فلترة المنتجات بالـ collection

```graphql
query {
  products(filters: { collection_ids: ["col_1", "col_2"] }) {
    data { id name }
    meta { total }
  }
}
```
الـ filter يسوي `OR` داخلياً (منتج موجود بأي collection من القائمة).

---

## 🧱 Input Shapes

### `CreateCollectionInput`

```ts
{
  name: { en: string, ar: string }        // REQUIRED — JSON translatable
  slug: string                             // REQUIRED — البَاك بيولّد فريد تلقائياً لو متكرر
  type?: "MANUAL" | "AUTOMATED"           // default MANUAL
  image?: { url: string, alt?: string }    // JSON — media object
  description?: { en: string, ar: string } // JSON translatable
  sort_order?: number                      // default 0 — للترتيب على الستورفرنت
  rules?: CollectionRules                  // REQUIRED لو type=AUTOMATED، مرفوض لو MANUAL
}
```

### `UpdateCollectionInput`

نفس الشكل لكن:
- `id` إلزامي
- كل الحقول الباقية اختيارية
- تعديل `rules` على AUTOMATED يعمل **membership sync فوري** (re-evaluate لكل المنتجات).

### `CollectionRules` (لـ AUTOMATED)

```ts
{
  match: "ALL" | "ANY"                    // AND vs OR
  conditions: CollectionRuleCondition[]   // max 10
}

type CollectionRuleCondition = {
  field: "system_category_id"
       | "price_cents"
       | "sale_type"
       | "status"
       | "tag"
       | "brand"
       | "product_type"
       | "attribute"
  operator: "EQ" | "NE" | "GTE" | "LTE" | "BETWEEN"
          | "IN" | "NOT_IN" | "CONTAINS" | "DESCENDANT_OF"
  value: string | number | string[] | number[] | [number, number]
  attribute_key?: string                  // REQUIRED لو field="attribute"
}
```

---

## 🎛️ جدول العمليات المسموحة لكل Field

| Field | Operators | قيمة `value` | مثال |
|---|---|---|---|
| `system_category_id` | `EQ`, `DESCENDANT_OF` | `string` | `{ field: "system_category_id", operator: "DESCENDANT_OF", value: "sc_laptops_id" }` |
| `price_cents` | `EQ`, `NE`, `GTE`, `LTE`, `BETWEEN` | `number` أو `[min, max]` | `{ field: "price_cents", operator: "LTE", value: 100000 }` (= ≤ $1,000) |
| `sale_type` | `EQ`, `NE`, `IN`, `NOT_IN` | `string` or `string[]` | `{ field: "sale_type", operator: "EQ", value: "FLASH_SALE" }` |
| `status` | `EQ`, `NE`, `IN`, `NOT_IN` | `string` or `string[]` | `{ field: "status", operator: "EQ", value: "PUBLISHED" }` |
| `tag` | `CONTAINS` | `string` (slug partial) | `{ field: "tag", operator: "CONTAINS", value: "summer" }` |
| `brand` | `EQ`, `NE`, `CONTAINS` | `string` | `{ field: "brand", operator: "EQ", value: "Apple" }` |
| `product_type` | `EQ`, `NE`, `IN`, `NOT_IN` | `string` or `string[]` | `{ field: "product_type", operator: "IN", value: ["SIMPLE","VARIABLE"] }` |
| `attribute` | `EQ`, `NE`, `GTE`, `LTE`, `BETWEEN`, `IN`, `NOT_IN` | depends on type | انظر تحت |

### `attribute` (الأهم)

الـ attribute هو metafield معرّف في `CategoryAttributeDefinition`. لازم `attribute_key` + operator مناسب للـ type:

```jsonc
// منتجات RAM ≥ 16GB
{
  "field": "attribute",
  "attribute_key": "ram_gb",
  "operator": "GTE",
  "value": 16
}

// منتجات باللون الأحمر أو الأسود
{
  "field": "attribute",
  "attribute_key": "color",
  "operator": "IN",
  "value": ["option_red_id", "option_black_id"]   // ← option IDs (مش values)
}
```

> ⚠️ لـ SELECT/MULTI_SELECT attributes: الـ value لازم يكون **option id** (مش الـ value string). الـ FE بيحوّل من الـ option.value → option.id قبل الإرسال.

---

## 🚨 Error Codes

| Code | سبب | كيف يعرضها الـ FE |
|---|---|---|
| `COLLECTION_RULES_REQUIRED` | AUTOMATED بدون rules | "لازم تضيف قاعدة واحدة على الأقل" |
| `COLLECTION_RULES_EMPTY` | `conditions: []` | نفس الأعلى |
| `COLLECTION_RULES_BUDGET_EXCEEDED` | `conditions.length > 10` | "الحد الأقصى 10 شروط لكل مجموعة" |
| `COLLECTION_RULES_BAD_MATCH` | `match` ليس `ALL/ANY` | FE bug — لا يحدث إذا الـ radio buttons صحيحة |
| `COLLECTION_RULES_UNKNOWN_FIELD` | field ليس في الـ whitelist | FE bug |
| `COLLECTION_RULES_UNSUPPORTED_OPERATOR` | operator ممنوع للـ field | "هذا الـ operator غير متاح لهذا الحقل" — تحديث dropdown |
| `COLLECTION_RULES_ATTRIBUTE_KEY_REQUIRED` | field=attribute بدون attribute_key | "اختر attribute أولاً" |
| `COLLECTION_RULES_BAD_BETWEEN` | BETWEEN بدون `[min, max]` | "حدد الحد الأدنى والأقصى" |
| `COLLECTION_MANUAL_ONLY_ACTION` | attach/detach على AUTOMATED | "لا يمكن التعديل يدوياً — هذه مجموعة ذكية" |
| `NOT_FOUND` | `collection.id` غير موجود في الـ shop | redirect لقائمة collections |

---

## 🖼️ UI Flow المقترح

### 1. صفحة List (`/store/stores/:shop/collections`)

```
┌────────────────────────────────────────────────────────┐
│ Collections                         [+ New Collection] │
├────────────────────────────────────────────────────────┤
│ 🏷️ Summer Sale            [AUTOMATED]  42 products  ⋯  │
│ 🏷️ Staff Picks            [MANUAL]     12 products  ⋯  │
│ 🏷️ Clearance              [AUTOMATED]   8 products  ⋯  │
└────────────────────────────────────────────────────────┘
```
- Drag & drop يعدّل `sort_order` (call `updateCollection` لكل واحد أو batch).
- `product_count` يجي من الـ backend — ما تحسبه قدّام.
- menu `⋯`: Edit, Duplicate (FE-only, clones the input), Delete.

### 2. Create/Edit Modal — MANUAL

```
┌──── Create Collection ──────────────┐
│ Name (EN) *  [ Staff Picks     ]    │
│ Name (AR) *  [ اختيارات الفريق    ]│
│ Slug *       [ staff-picks     ]    │
│ Type         ⦿ Manual  ○ Automated  │
│ Image        [ Upload... ]          │
│ Description  [ ...           ]      │
│                                     │
│ Products (after save):              │
│ 🔍 [ search products...        ]    │
│ • iPhone 15       [remove]          │
│ • MacBook Air     [remove]          │
│ • AirPods Pro     [remove]          │
│                                     │
│              [Cancel]  [Save]       │
└─────────────────────────────────────┘
```

**flow:**
1. `createCollection` → يرجع الـ `id`.
2. لكل منتج تم اختياره: `attachProductToCollection(collection_id, product_id)`.
3. لو remove: `detachProductFromCollection(...)`.

### 3. Create/Edit Modal — AUTOMATED (⭐ الأهم)

```
┌──── Create Smart Collection ────────────────────────┐
│ Name / Slug / Image / Description (زي MANUAL)        │
│ Type: ○ Manual  ⦿ Automated                          │
│                                                      │
│ Match:  ⦿ All conditions (AND)                       │
│         ○ Any condition  (OR)                        │
│                                                      │
│ Conditions:                                          │
│ ┌──────────────────────────────────────────────┐    │
│ │ [Category ▼] [Descendant of ▼] [Laptops ▼] × │    │
│ └──────────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────┐    │
│ │ [Price ▼] [Less than ▼] [100000] cents     × │    │
│ └──────────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────┐    │
│ │ [Attribute ▼] [ram_gb] [≥] [16]             ×│    │
│ └──────────────────────────────────────────────┘    │
│                                  [+ Add condition]   │
│                                                      │
│ 🔍 Preview: 23 products match                        │
│                                                      │
│              [Cancel]  [Save]                        │
└──────────────────────────────────────────────────────┘
```

**تفاصيل الـ FE:**

- **Field dropdown**: يعرض الـ 8 fields من الجدول فوق. `attribute` يكشف `attribute_key` combobox (الـ keys اللي بتجي من `categoryAttributes(system_category_id)` بعد ما يختار المستخدم category).
- **Operator dropdown**: يتبدّل بناءً على الـ field — ما تعرض operator مش مسموح.
- **Value input**: شكله يتبدل:
  - `price_cents` → number input + helper "cents = price × 100"
  - `status` → select من enum (`PUBLISHED`, `DRAFT`, `ARCHIVED`)
  - `system_category_id` → category picker (tree)
  - `BETWEEN` → حقلين `[min, max]`
  - `IN/NOT_IN` → multi-select chips
  - `attribute` مع SELECT/MULTI_SELECT type → خيارات الـ definition
- **Preview**: بعد debounce 400ms، `FE` يبعث `products(filters: {...})` مع rules مترجمة (اختياري — بس تجربة تقديرية). الـ **فعلي** بيحدّد عند الحفظ.

---

## 💡 أمثلة rules جاهزة لـ FE

### (أ) لابتوبات تحت $1000 — Intel فقط

```json
{
  "match": "ALL",
  "conditions": [
    { "field": "system_category_id", "operator": "DESCENDANT_OF", "value": "sc_laptops_id" },
    { "field": "price_cents",        "operator": "LTE",           "value": 100000 },
    { "field": "attribute",          "attribute_key": "processor", "operator": "CONTAINS", "value": "Intel" }
  ]
}
```

### (ب) خصم: كل منتج فيه sale_type=FLASH أو %off > 20

```json
{
  "match": "ANY",
  "conditions": [
    { "field": "sale_type", "operator": "EQ", "value": "FLASH_SALE" },
    { "field": "tag",       "operator": "CONTAINS", "value": "clearance" }
  ]
}
```

### (ج) Apple Products — منشورة فقط

```json
{
  "match": "ALL",
  "conditions": [
    { "field": "brand",  "operator": "EQ", "value": "Apple" },
    { "field": "status", "operator": "EQ", "value": "PUBLISHED" }
  ]
}
```

### (د) ملابس size M أو L بلون أحمر

```json
{
  "match": "ALL",
  "conditions": [
    { "field": "system_category_id", "operator": "DESCENDANT_OF", "value": "sc_clothing_id" },
    { "field": "attribute", "attribute_key": "size",  "operator": "IN", "value": ["opt_m_id", "opt_l_id"] },
    { "field": "attribute", "attribute_key": "color", "operator": "EQ", "value": "opt_red_id" }
  ]
}
```

---

## 🧪 React / Apollo — كود FE جاهز

### Mutation — إنشاء AUTOMATED collection

```tsx
import { gql, useMutation } from '@apollo/client';

const CREATE_COLLECTION = gql`
  mutation CreateCollection($input: CreateCollectionInput!) {
    createCollection(input: $input) {
      success
      data { id slug rules_version product_count }
    }
  }
`;

function CreateSmartCollection({ shopId }: { shopId: string }) {
  const [createCollection, { loading, error }] = useMutation(CREATE_COLLECTION, {
    context: { headers: { 'X-SHOP': shopId } },   // ⚠️ لازم
  });

  const handleSubmit = async () => {
    await createCollection({
      variables: {
        input: {
          name: { en: 'Cheap Laptops', ar: 'لابتوبات رخيصة' },
          slug: 'cheap-laptops',
          type: 'AUTOMATED',
          rules: {
            match: 'ALL',
            conditions: [
              { field: 'system_category_id', operator: 'DESCENDANT_OF', value: 'sc_laptops_id' },
              { field: 'price_cents',        operator: 'LTE',           value: 100000 },
            ],
          },
        },
      },
    });
  };
  // ...
}
```

### useQuery — list مع pagination

```tsx
const LIST = gql`
  query Collections($page: Int, $limit: Int) {
    collections(page: $page, limit: $limit) {
      data { id type name slug image product_count }
      meta { total page total_pages }
    }
  }
`;

const { data } = useQuery(LIST, {
  variables: { page: 1, limit: 20 },
  context: { headers: { 'X-SHOP': shopId } },
});
```

### Attach/Detach — MANUAL

```tsx
const ATTACH = gql`
  mutation Attach($collection_id: String!, $product_id: String!) {
    attachProductToCollection(collection_id: $collection_id, product_id: $product_id) {
      data { id product_count }
    }
  }
`;

const DETACH = gql`
  mutation Detach($collection_id: String!, $product_id: String!) {
    detachProductFromCollection(collection_id: $collection_id, product_id: $product_id) {
      data { id product_count }
    }
  }
`;
```

> **FE tip:** بعد attach/detach، الـ `product_count` بيرجع محدّث — استخدمه لتحديث الـ cache مباشرة بدل re-fetch.

### إضافة منتج لـ collection عند الإنشاء (shortcut)

لو الـ vendor صانع منتج جديد من صفحة product form، يقدر يحدد `collection_ids[]` مباشرة:

```graphql
mutation {
  createProduct(input: {
    name: { en: "MacBook Pro" }
    type_id: "..."
    collection_ids: ["col_staff_picks", "col_premium"]    # ← MANUAL فقط
    # ...
  }) { data { id collections { id name } } }
}
```
الـ backend يضيفه لـ junction table `CollectionProduct` بـ `createMany`.

لـ AUTOMATED: **لا ترسل `collection_ids`** — الـ backend بيقيّم الـ rules ويضيفه تلقائياً (عبر `evaluateForProduct`).

---

## 🔄 Automated Membership — كيف بيشتغل

### السيناريو 1: تعديل rules

1. vendor يعدّل rules في الـ form → `updateCollection({ rules })`.
2. الـ backend:
   - validates الـ rules shape (`validateRules`) — يرجّع error لو غلط.
   - compiles لـ `Prisma.ProductWhereInput`.
   - يسحب كل المنتجات المطابقة في الـ shop.
   - يحسب `toInsert` + `toDelete` (set diff).
   - `CollectionProduct.createMany` + `deleteMany`.
3. الـ `product_count` بيصير دقيق فوراً.

### السيناريو 2: تعديل منتج

1. vendor يحفظ product edit (مثلاً غيّر الـ price).
2. `ProductsService` بينادي `collectionsService.evaluateForProduct(productId, shopId)`.
3. الـ backend يمرّ على كل AUTOMATED collections في الـ shop:
   - لو المنتج بيطابق الـ rules → يضيفه (upsert).
   - لو ما بيطابق → يحذفه (deleteMany).
4. الـ FE ما عنده شي يعمله — automatic.

> ⚠️ **ملاحظة حالية (2026-04-22):** الـ wiring من `ProductsService` لـ `evaluateForProduct` **deferred** (راجع [PRODUCTS.md §16.8](./PRODUCTS.md#168-out-of-scope-في-هذا-الـ-pr-roadmap-items)). حالياً membership sync بيصير بس عند تعديل rules. Product-side trigger في الـ roadmap.

---

## ✅ FE Checklist قبل الـ PR

- [ ] `X-SHOP` header في كل requests للـ collections
- [ ] الـ `slug` field اسمح بـ lowercase + dash + digit فقط (client-side pre-validation)
- [ ] عند type=AUTOMATED → اعرض rule builder، اخفي "Products" tab
- [ ] عند type=MANUAL → اعرض "Products" tab، اخفي rule builder
- [ ] **ما تسمح** بتبديل type بعد الإنشاء (الـ backend يقبل، بس UX فوضى — رسالة "احذف وأعد الإنشاء لو بدك تغيّر النوع")
- [ ] عدّاد conditions: lock الـ "+ Add condition" عند 10
- [ ] operator dropdown ديناميكي حسب field
- [ ] `system_category_id` picker → tree modal من `systemCategoriesFlat`
- [ ] `attribute_key` combobox → `categoryAttributes(system_category_id)` — لو ما اختار category أعرض hint
- [ ] `price_cents` helper: عرض `$1,000.00` تحت الحقل لما يكتب `100000`
- [ ] عند `COLLECTION_MANUAL_ONLY_ACTION` → اعرض toast + disable زر الـ attach/detach
- [ ] `rules_version` للـ optimistic UI (لو المستخدم بيعدّل، اعرض loading على الـ product_count لحد ما يرد الـ backend)
- [ ] Delete confirmation مع عرض `product_count` ("هذه المجموعة فيها 42 منتج. المنتجات ما رح تنحذف، بس رح يتم فصلها عن المجموعة.")

---

## 📎 مراجع سريعة

| ملف | الدور |
|---|---|
| [src/collections/collections.resolver.ts](../src/collections/collections.resolver.ts) | GraphQL endpoints |
| [src/collections/collections.service.ts](../src/collections/collections.service.ts) | business logic + membership sync |
| [src/collections/evaluator/collection-rule.evaluator.ts](../src/collections/evaluator/collection-rule.evaluator.ts) | validateRules + compileRules |
| [src/collections/dto/create-collection.input.ts](../src/collections/dto/create-collection.input.ts) | CreateCollectionInput shape |
| [src/collections/types/collection.types.ts](../src/collections/types/collection.types.ts) | CollectionEntry response shape |
| [docs-v2/PRODUCTS.md §16.3](./PRODUCTS.md#163-collection-manual--automated) | الخلفية المعمارية |
| [docs-v2/PRODUCTS.md §16.10](./PRODUCTS.md#1610-error-codes-الجديدة) | كامل error codes |
