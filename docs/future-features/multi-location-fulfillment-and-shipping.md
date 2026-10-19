# Future Feature — Multi-Location Fulfillment + Shipping Providers

**Status:** PHASE 0 → 3 مُنجزة ومطبَّقة على الإنتاج (2026-08-21) · PHASE 4 → 7 لم تبدأ.
**ما تبقّى بالتفصيل:** [multi-location-remaining-plan.md](multi-location-remaining-plan.md) — هذا الملف يبقى مرجع التصميم والأسباب.
**Created:** 2026-08-21
**Scope:** Order Allocation / Routing Engine · فصل Fulfillment عن Shipment · Shipping Provider abstraction (OTO أولًا، ثم SPL / Aramex / DHL) · فصل `actualShippingCost` عن `customerShippingCharge` عن `merchantShippingSubsidy`.

> **الخلاصة في سطرين:** طبقة المخزون متعددة المواقع **موجودة وجيدة جدًا** (`InventoryLocation` + `InventoryLevel` + `InventoryAdjustment` + `InventoryTransfer`). المفقود هو **كل ما فوقها**: لا يوجد Allocation Engine إطلاقًا — كل مسار الطلب يستدعي `getOnlineFulfillingLocation(shopId)` التي تُرجع **موقعًا واحدًا فقط**. النظام اليوم multi-location في الدفتر، و single-location في التنفيذ.

---

## 1. ما هو موجود فعلًا — لا تُعِد بناءه

فحصتُ `back-end/prisma/schema.prisma` (5404 سطر) و `src/{inventory,orders,shipping,shipments,cart,checkout,integrations}`. هذه القائمة هي ما يجب **إعادة استخدامه** لا استبداله:

| الموجود | الملف | التقييم مقابل التصميم المطلوب |
|---|---|---|
| `InventoryLocation` | `schema.prisma:941` | ✅ **مطابق تمامًا** لمفهوم `Location` المطلوب. فيه `address_*` و `country` (ISO-2) و `is_default` و `is_active` و `fulfills_online_orders` و soft delete، و partial unique index يضمن default واحدًا لكل shop. |
| `InventoryLevel` | `schema.prisma:1005` | ✅ **أقوى من المطلوب.** أربعة عدّادات لكل (location, product\|variant): `available` / `committed` / `incoming` / `on_hand`، زائد أربعة buckets للـ unavailable. XOR constraint على product/variant. هذا هو الـ source of truth الذي طلبتَه — وهو موجود. |
| `InventoryAdjustment` | `schema.prisma:1073` | ✅ Append-only ledger مع `reason` و `delta` و `available_before/after` و polymorphic `reference_type`/`reference_id`. كل حركة مخزون مُدقَّقة. |
| `InventoryTransfer` + `Line` | `schema.prisma:1156` | ✅ نقل مخزون بين موقعين بآلة حالات كاملة (DRAFT → READY_TO_SHIP → SENT → PARTIAL → RECEIVED). |
| `ShippingZone` + `ShippingRule` | `schema.prisma:3262` | ✅ تسعير شحن **مُدرك للوجهة**: العنوان يختار zone (الأكثر تحديدًا يفوز)، والـ rule يحسب fixed / percentage / free / weight_based. |
| `StockReservation` | `schema.prisma:4638` | ⚠️ موجود مع `location_id` **مضاف مسبقًا** — لكنه يُملأ دائمًا من الموقع الافتراضي (انظر G8). |
| `Fulfillment` + `FulfillmentLineItem` | `schema.prisma:2641` | ⚠️ موجود لكنه ضعيف — انظر G2. |
| `Shipment` | `schema.prisma:3832` | ⚠️ موجود لكنه مرتبط بـ `Order` لا بـ `Fulfillment` — انظر G3. |
| `IdempotencyRecord` | `schema.prisma:4674` | ✅ مفتاح العميل ← استجابة مخزّنة. جاهز لحماية `allocateOrder` و `createShipment`. |
| `IntegrationConfig` + `provider-registry.ts` | `src/integrations/` | ✅ **هذا بالضبط الـ abstraction الذي طلبته** — كتالوج مزوّدين مع `fields` / `schema` / `verify`، وسرّيات مشفّرة AES-256-GCM، وواجهة أدمن تُرسم من الخادم. أعِد استخدام النمط حرفيًا لـ Shipping. |
| `adjust()` CAS guard | `inventory.service.ts:201` | ✅ التحديث مشروط داخل `updateMany` ويرمي `STOCK_RACE` — أي oversell تحت التزامن مُغلق **على مستوى الـ level**. |
| `checkout.verify()` | `checkout.service.ts:26` | ✅ التسعير server-authoritative بالكامل (subtotal و shipping و tax و discount محسوبة في الخادم). |

**الاستنتاج:** ما يقارب 60% من النموذج الذي طلبتَه مبنيّ بالفعل، وبجودة عالية. الفجوة ليست في المخزون — بل في **قرار التنفيذ** وفي **الشحن**.

---

## 2. المراجعة المعمارية — الفجوات والمشاكل

### G1 · لا يوجد Allocation Engine — المسار كله موقع واحد 🔴 حرِج

كل مسار في دورة حياة الطلب يستدعي نفس الدالة:

```ts
// inventory.service.ts:117 — تُرجع موقعًا واحدًا: الافتراضي، وإلا أقدم موقع نشط
async getOnlineFulfillingLocation(shopId): Promise<{ id: string }>
```

مواضع الاستدعاء الأربعة (`orders.service.ts:211, 277, 386, 1002`) هي: تثبيت البيع (SALE)، وإرجاع مخزون الإلغاء، وإرجاع مخزون المرتجع، وإنشاء الـ Fulfillment. أي أن **الطلب بأكمله يُخصم دائمًا من موقع واحد**، بغضّ النظر عن أين يوجد المخزون فعليًا.

النتيجة المباشرة: تاجر لديه موقعان، والمنتج متوفر في الموقع B فقط ← الطلب يُخصم من A ← `available` في A يصير سالبًا أو يُرفض بـ `INSUFFICIENT_STOCK` رغم أن البضاعة موجودة.

### G2 · `Fulfillment.location_id` سلسلة نصية بلا FK، ويُبتلع الخطأ صمتًا 🔴 حرِج

```prisma
location_id String?   // لا relation، لا FK، لا shop_id
```

وفي `createFulfillmentTx` (`orders.service.ts:999`):

```ts
try   { locationId = (await this.inventory.getOnlineFulfillingLocation(...)).id }
catch { locationId = null }        // ← يُبتلع
...
if (locationId) { await this.inventory.fulfill(...) }   // ← وإلا: لا حركة مخزون إطلاقًا
```

إذا فشل حلّ الموقع، يُكتب Fulfillment **بلا أي خصم من المخزون** ولا رسالة خطأ. هذا انحراف مخزون صامت (silent inventory drift). ونفس النمط داخل `InventoryService.fulfill()` نفسها: لو كان `committed < quantity` فهي تُسجّل `logger.warn` وتعود — لا ترمي.

### G3 · `Shipment` معلّق على `Order` لا على `Fulfillment` 🔴 حرِج

```prisma
model Shipment { order_id String ... }   // لا fulfillment_id، لا line items، لا origin location
```

هذا يجعل ثلاثة من متطلباتك **غير قابلة للتمثيل أصلًا**:

- شحنة واحدة لأكثر من fulfillment (الدمج) — مستحيلة.
- أكثر من شحنة لـ fulfillment واحد (طرد كبير مقسّم) — مستحيلة.
- معرفة **ماذا** بداخل الشحنة — مستحيلة، لا يوجد `ShipmentLineItem`.

كما أن `delivery_company` و `Order.logistics_provider` نصوص حرّة، و `provider_response Json` هو كل ما يربطنا بأي مزوّد.

### G4 · لا يوجد أي فصل بين التكلفة والرسوم 🔴 حرِج

يوجد رقم واحد فقط: `Order.delivery_fee_cents` = ما دفعه العميل. لا `actual_cost`، ولا `subsidy`، ولا أي عمود مالي على `Shipment` إطلاقًا. مثالك (45 فعلي / 20 على العميل / 25 على التاجر) غير قابل للتخزين اليوم.

### G5 · لا توجد أي تكاملات شحن 🟠

بحثتُ عن OTO و Aramex و SPL و SMSA و Torod في كامل `src/` و `schema.prisma`: **صفر نتائج** عدا تعليق واحد يذكر "DHL, Aramex" كنص حرّ في حقل `shipping_carrier` الخاص بأوامر الشراء. و `IntegrationType` enum لا يحتوي `SHIPPING`.

### G6 · لا يوجد `ShippingProviderLocation` mapping 🟠

مخاوفك في محلها — لا يوجد جدول ربط بين موقعنا الداخلي وموقع المزوّد. (الجانب الإيجابي: لا يوجد أيضًا أي تلوّث بمعرّفات خارجية داخل `InventoryLocation`، فالبداية نظيفة.)

### G7 · التوفّر يُفحص على rollup إجمالي، لا لكل موقع 🔴 الأخطر عمليًا

```sql
-- inventory.service.ts:1394 (syncRollup)
UPDATE products SET quantity = (SELECT SUM(available) FROM inventory_levels WHERE product_id = ...)
```

والسلة تسمح بالإضافة على أساس `quantity - reserved_quantity`. المشكلتان:

1. **الـ SUM لا يستثني المواقع التي `fulfills_online_orders = false`.** مخزون مستودع مغلق أمام الويب يُحتسب ضمن ما يراه العميل كمتاح ← طلب يُقبل ولا يمكن تنفيذه.
2. **3 قطع موزّعة 1+1+1 على ثلاثة مواقع تبدو "3 متاحة".** العميل يطلب 3، ثم يكتشف الـ allocation أن الحدّ الأدنى هو **ثلاث شحنات** — وهو ما تقول قاعدتك رقم 2 صراحةً إنه يجب تجنّبه. القرار اتُّخذ متأخرًا جدًا.

**هذه أهم مشكلة في الملف.** الـ allocation يجب أن يُستشار وقت الـ checkout، لا بعد إنشاء الطلب.

### G8 · الحجوزات مثبّتة على الموقع الافتراضي 🟠 (مفعّلة في الإنتاج)

`StockReservation.resolveDefaultLocationId()` تربط كل حجز بالموقع الافتراضي عبر SQL خام. ومرآة الحجز في `inventory_levels.committed` تُبنى على هذا العمود. تحت multi-location: `committed` يتراكم في A بينما البضاعة في B ← ثم `fulfill()` تجد `committed < qty` في B **وتتخطّى بصمت** (G2). انحراف مركّب.

العلم `ENABLE_STOCK_RESERVATION="true"` مضبوط في `back-end/.env` — أي أن هذا المسار **حيّ الآن**، لا خاملًا.

### G9 · إرجاع المرتجعات يذهب للموقع الخطأ 🟠

`recordReturnAdjustments` (`orders.service.ts:277`) تستخدم نفس `getOnlineFulfillingLocation`. أي أن المرتجع يُضاف إلى الموقع الافتراضي **لا إلى الموقع الذي شُحنت منه القطعة**. هذا يخلق مخزونًا وهميًا في A ويُنقصه في B.

### G10 · رسوم الشحن تُحسب مرة واحدة للسلة كلها بلا مصدر

`checkout.service.ts` يختار zone واحدًا لكل shop ويحسب رسمًا واحدًا. لا مفهوم لـ origin، فلا يمكن للنظام أن يعرف التكلفة الحقيقية لطلب مقسّم.

### Edge cases إضافية يجب تغطيتها في التصميم

| الحالة | الخطر |
|---|---|
| موقع يُحذف soft-delete بينما عليه fulfillments مفتوحة | `location_id` بلا FK لن يمنع ذلك |
| تعديل الطلب بعد الـ allocation | لا آلية إعادة تخصيص (re-allocation) |
| `continue_selling_when_out_of_stock` (oversell) | أي موقع يُخصم منه عند التجاوز؟ يلزم قرار صريح |
| Digital / `requires_shipping = false` | يجب استثناؤها من الـ allocation كليًا وإلا أنتجت شحنات فارغة |
| Multi-vendor cart (`Order.parent_id` / children) | الـ allocation لكل shop على حدة، والشحن يُجمع للعميل — تفاعل غير محسوم |
| إلغاء جزئي بعد إنشاء الشحنة عند المزوّد | يلزم مسار `cancelShipment` لدى المزوّد + تعويض |
| Webhook مكرر من المزوّد | `ProcessedWebhookEvent` موجود — أعِد استخدامه |
| العملة | `Order.currency` snapshot موجود؛ تكلفة المزوّد قد تأتي بعملة أخرى ← خزّن كليهما |
| COD | لا يوجد أي تمثيل له اليوم؛ OTO يطلبه |
| الأبعاد والوزن | `Product` فيه وزن (`WeightUnit` enum موجود) لكن **لا أبعاد** — OTO يطلب الأبعاد |

---

## 3. الـ Domain Model المقترح

المبدأ الذي طلبتَه سليم تمامًا، وأتبنّاه كما هو مع تسمية تتوافق مع الموجود:

```
Shop
 └── InventoryLocation (=Location)          ← مصدر الحقيقة للمخزون. موجود ✅
      ├── InventoryLevel  (available/committed/incoming/on_hand)   موجود ✅
      └── ShippingProviderLocation          ← جديد: الربط بمعرّف المزوّد الخارجي
Order
 ├── OrderProduct                           موجود ✅
 └── Fulfillment  (order + location واحد)   موجود، يحتاج تقوية
      ├── FulfillmentLineItem               موجود ✅
      └── Shipment  (1..N لكل fulfillment)  ← يُعاد ربطه
           ├── ShipmentLineItem             ← جديد
           └── ShipmentPackage              ← جديد (وزن/أبعاد لكل طرد)
ShippingQuote  (لقطة تسعير وقت الـ checkout)  ← جديد
ShopShippingPolicy (سياسة من يدفع)            ← جديد
```

**الحدود الصارمة (وهي جوهر طلبك):**

- `Fulfillment` = **قرار**: أي أصناف من أي موقع. لا يعرف شيئًا عن أي شركة شحن.
- `Shipment` = **تنفيذ**: طرد فعلي عند مزوّد. لا يقرّر موقعًا أبدًا.
- `ShippingProvider` = **adapter**: يستقبل origin و destination و packages ويُعيد rate / label / tracking. **لا يُستشار في اختيار الموقع إطلاقًا.**
- `core domain` (orders/inventory) لا يستورد أي رمز خاص بـ OTO. الاستيراد باتجاه واحد فقط: `shipping-providers → core`.

---

## 4. الـ Prisma Schema المقترح (دلتا فقط)

```prisma
// ─── تقوية Fulfillment (تعديل الموجود) ─────────────────────────────
model Fulfillment {
  // ... الحقول الحالية تبقى
  location    InventoryLocation @relation(fields: [location_id], references: [id])
  location_id String            // كان String? بلا relation — يصبح إلزاميًا + FK
  shop_id     String            // للعزل متعدد المستأجرين والفهرسة
  status      FulfillmentStatus @default(PENDING)   // كان String
  shipments   Shipment[]
  @@index([shop_id, status])
  @@index([location_id])
}

enum FulfillmentStatus { PENDING PACKED SHIPPED DELIVERED CANCELLED }

// ─── إعادة ربط Shipment (تعديل الموجود) ────────────────────────────
model Shipment {
  // order_id يبقى (denormalized للاستعلام السريع) لكن المالك الحقيقي هو:
  fulfillment    Fulfillment @relation(fields: [fulfillment_id], references: [id])
  fulfillment_id String

  provider_id           String?   // → ShippingProviderAccount
  provider_shipment_id  String?   // معرّف الشحنة عند OTO
  provider_status_raw   String?   // حالة المزوّد الخام قبل التطبيع

  // المال — ثلاثة أرقام منفصلة (لبّ الطلب)
  actual_cost_cents        Int    @default(0)  // ما نُحاسَب عليه فعليًا
  allocated_charge_cents   Int    @default(0)  // حصة هذه الشحنة من رسم العميل
  currency                 String @default("SAR")
  cost_currency            String?             // عملة فاتورة المزوّد إن اختلفت

  label_url        String?
  cod_amount_cents Int?
  line_items       ShipmentLineItem[]
  packages         ShipmentPackage[]
  @@unique([provider_id, provider_shipment_id])
  @@index([fulfillment_id])
}

model ShipmentLineItem {
  id                       String @id @default(cuid())
  shipment_id              String
  fulfillment_line_item_id String
  quantity                 Int
  @@index([shipment_id])
}

model ShipmentPackage {
  id           String @id @default(cuid())
  shipment_id  String
  weight_grams Int
  length_mm    Int?
  width_mm     Int?
  height_mm    Int?
  @@index([shipment_id])
}

// ─── الربط بالمزوّد (جديد) ──────────────────────────────────────────
model ShippingProviderAccount {
  id          String  @id @default(cuid())
  shop_id     String?          // null = حساب المنصّة المشترك
  provider    String           // 'oto' | 'spl' | 'aramex' | 'dhl'
  credentials String           // نفس مغلّف AES-256-GCM المستخدم في IntegrationConfig
  is_enabled  Boolean @default(false)
  last_verified_at DateTime?
  locations   ShippingProviderLocation[]
  @@unique([shop_id, provider])
}

model ShippingProviderLocation {
  id                   String @id @default(cuid())
  location_id          String   // ← معرّفنا الداخلي يبقى الـ primary دائمًا
  provider_account_id  String
  external_location_id String   // ← معرّف OTO — لا يُستخدم كمفتاح في أي مكان آخر
  @@unique([location_id, provider_account_id])
  @@unique([provider_account_id, external_location_id])
}

// ─── سياسة الشحن لكل متجر (جديد) ────────────────────────────────────
enum ShippingPolicyMode {
  CUSTOMER_PAYS_ACTUAL      // العميل يدفع التكلفة الحقيقية
  MERCHANT_ABSORBS_EXTRA    // العميل يدفع شحنة واحدة، التاجر يتحمّل الباقي
  FLAT_RATE                 // سعر ثابت
  FREE                      // شحن مجاني
  FREE_ABOVE_THRESHOLD      // مجاني فوق مبلغ
}

model ShopShippingPolicy {
  id                     String @id @default(cuid())
  shop_id                String @unique
  mode                   ShippingPolicyMode @default(MERCHANT_ABSORBS_EXTRA)
  flat_rate_cents        Int  @default(0)
  free_above_cents       Int? // لـ FREE_ABOVE_THRESHOLD
  max_customer_fee_cents Int? // سقف مهما بلغت التكلفة الفعلية
}

// ─── لقطة التسعير (جديد) ────────────────────────────────────────────
// تُنشأ وقت الـ checkout وتُثبَّت على الطلب: ما رآه العميل هو ما يُحاسَب به.
model ShippingQuote {
  id                    String   @id @default(cuid())
  shop_id               String
  cart_id               String?
  order_id              String?  @unique
  plan                  Json     // خطة الـ allocation المُجمّدة
  estimated_cost_cents  Int      // مجموع تقديرات المزوّد
  customer_charge_cents Int      // ما دفعه العميل
  policy_mode           ShippingPolicyMode
  expires_at            DateTime
  @@index([cart_id])
}

// ─── تجميع على Order (تعديل) ────────────────────────────────────────
model Order {
  // delivery_fee_cents يبقى = customerShippingCharge (لا تكسر شيئًا)
  shipping_actual_cost_cents Int @default(0)  // مجموع Shipment.actual_cost_cents
  shipping_subsidy_cents     Int @default(0)  // المشتقّ: actual − charge (≥ 0)
}
```

**ملاحظة مهمة:** `merchantShippingSubsidy` **مشتقّ لا مُدخل** — `max(0, actual − charge)`. خزّنه كعمود لسرعة التقارير فقط، واحسبه دائمًا من الشحنات ولا تسمح بكتابته يدويًا.

كذلك يلزم إضافة أبعاد للمنتج (`length_mm` / `width_mm` / `height_mm` على `Product` و `VariationOption`) — OTO يطلبها ولا وجود لها اليوم.

---

## 5. Order Allocation Engine

**الموقع:** وحدة جديدة `back-end/src/fulfillment-allocation/` — منفصلة عن `orders` و `inventory` كليهما، لأنها تقرأ من الاثنين ولا تملك أيًّا منهما.

**التوقيع — دالة نقيّة قدر الإمكان:**

```ts
allocate(input: {
  shopId: string
  lines: Array<{ orderProductId, productId, variationOptionId, quantity, requiresShipping }>
  destination: { country, state, city, zip }
  strategy: AllocationStrategy
}): AllocationPlan   // { fulfillments: [{ locationId, lines[] }], unfulfillable: [] }
```

**الخوارزمية — أربع مراحل:**

**المرحلة 0 — التصفية.** استبعد الأسطر التي `requiresShipping = false`. اجلب المواقع النشطة التي `fulfills_online_orders = true` فقط. اقرأ `InventoryLevel.available` لكل (موقع، صنف) في استعلام واحد.

**المرحلة 1 — البحث عن حلّ من موقع واحد (القاعدتان 1 و 2).**
رشِّح كل موقع يغطّي **كل** الأسطر بالكامل. إن وُجد واحد أو أكثر ← رتّبهم بالنتيجة أدناه واختر الأفضل. **انتهى — شحنة واحدة.** هذا هو المسار الغالب ويجب أن يكون سريعًا.

**المرحلة 2 — التقسيم (القاعدة 4)، فقط عند فشل المرحلة 1.**
Greedy set-cover: اختر الموقع الذي يغطّي أكبر عدد من **الأسطر الكاملة** (لا الكميات — القطع الجزئية تُنتج شحنات إضافية)، اطرح ما غطّاه، وكرّر. حدّ أقصى `MAX_SPLITS` (اقترح 3) — ما بعده يُعلَن `unfulfillable` بدل توليد خمس شحنات.

**المرحلة 3 — التسعير والتقييم.** لكل مرشّح: اطلب تسعيرة من المزوّد (أو من `ShippingZone` المحلي) واحسب النتيجة النهائية.

**دالة الترجيح — أوزان قابلة للتهيئة لكل متجر:**

```ts
score =  w_splits   × (عدد الشحنات)          // الوزن الأكبر بفارق كبير — قاعدتك رقم 2
       + w_cost     × (التكلفة / 1000)
       + w_distance × (المسافة بالكم / 100)  // haversine على العنوان
       + w_sla      × (أيام التوصيل)
       − w_priority × (أولوية الموقع)        // ما يحدّده التاجر
// افتراضي مقترح: splits=1000, cost=1, distance=0.5, sla=10, priority=50
```

`w_splits = 1000` يجعل "شحنة أقل" يفوز عمليًا دائمًا على أي فرق تكلفة معقول — وهو ما طلبتَه صراحة في القاعدة 2.

**متى تُستدعى — وهذه النقطة الحاسمة (تعالج G7):**

| اللحظة | الاستدعاء | الغرض |
|---|---|---|
| عرض السلة | `previewAllocation` | "متوفر" / "يُشحن على دفعتين" |
| `checkout.verify()` | `allocate` + تسعير | **يحدّد رسم الشحن المعروض** ويكتب `ShippingQuote` |
| `createOrder` | `allocate` مرة أخرى داخل الـ tx | التحقق النهائي + كتابة الـ Fulfillments |

التسعير في `verify` وحده لا يكفي — يجب **إعادة** التنفيذ داخل معاملة إنشاء الطلب، لأن المخزون قد يتغيّر بينهما. إن اختلفت الخطة عن الـ quote: احترم سعر العميل (`ShippingQuote` مجمّد) وتحمّل الفرق كـ subsidy. **لا تُفاجئ العميل بسعر جديد بعد الدفع.**

---

## 6. تدفّق الشحن وطبقة المزوّدين

```
checkout.verify → allocate → ShippingProviderRegistry.rate(candidates)
                                     ↓
                          ShippingQuote (مجمّد، expires_at)
                                     ↓
createOrder (tx) → allocate ثانية → Fulfillment[] + commit المخزون
                                     ↓
                    vendor يضغط "شحن" أو job تلقائي
                                     ↓
ShippingProvider.createShipment({ origin, destination, packages, items, cod })
                                     ↓
              Shipment (provider_shipment_id, label_url, actual_cost_cents)
                                     ↓
                    webhook المزوّد → normalize → tracking
```

**واجهة المزوّد — العقد الوحيد الذي يعرفه الـ core:**

```ts
export interface ShippingProvider {
  readonly slug: string;                  // 'oto' | 'spl' | 'aramex' | 'dhl'
  readonly capabilities: { rates: boolean; labels: boolean; cod: boolean; cancel: boolean };

  verify(creds): Promise<VerifyResult>;            // نفس شكل provider-registry الحالي
  rate(req: RateRequest): Promise<RateOption[]>;
  createShipment(req: CreateShipmentRequest): Promise<ProviderShipment>;
  cancelShipment(id: string): Promise<void>;
  track(id: string): Promise<TrackingUpdate>;
  parseWebhook(payload, headers): Promise<TrackingUpdate | null>;  // يشمل التحقق من التوقيع
}
```

`RateRequest` يحمل **origin address** (من `InventoryLocation`) و destination و packages و items و COD — ولا يحمل أي `locationId` داخلي. المزوّد يستلم عنوانًا، لا قرارًا.

**التسجيل:** أعِد استخدام نمط `src/integrations/provider-registry.ts` حرفيًا — كتالوج `fields`/`schema`/`verify`، والسرّيات عبر `SecretCryptoService`، وواجهة الأدمن تُرسم من الخادم. أضِف `SHIPPING` إلى `IntegrationType`، أو (الأفضل) اجعلها `ShippingProviderAccount` مستقلة لأنها **لكل متجر** بينما `IntegrationConfig` على مستوى المنصّة.

**إضافة SPL / Aramex لاحقًا (المتطلب 13):** ملف adapter جديد + إدخال في الكتالوج + صفّ `ShippingProviderLocation`. **صفر تغيير** في `orders` أو `inventory` أو `fulfillment-allocation` — لأن الـ allocation يعمل على `InventoryLevel` والعناوين فقط، والمزوّد لا يظهر إلا في مرحلة التسعير والتنفيذ.

**الـ fallback:** إن لم يوجد مزوّد مفعّل، `rate()` تعود إلى `ShippingZone` / `ShippingRule` الحالية، وتُنشأ الشحنة يدويًا. هذا يبقي المتاجر الحالية تعمل بلا تغيير.

---

## 7. حساب المال — أين ولماذا

**التسعير في الخادم حصرًا، وفي `checkout.verify()` تحديدًا** — نفس المكان الذي يحسب فيه اليوم. لا تُعِد اختراع مسار.

```
actualShippingCost     = Σ Shipment.actual_cost_cents          ← حقيقة من المزوّد
customerShippingCharge = policy(actualCost, subtotal, ...)     ← يُثبَّت في ShippingQuote
merchantSubsidy        = max(0, actual − charge)               ← مشتقّ، لا يُكتب يدويًا
```

تطبيق السياسة (`ShopShippingPolicy.mode`):

| Mode | `customerShippingCharge` |
|---|---|
| `CUSTOMER_PAYS_ACTUAL` | `actualCost` |
| `MERCHANT_ABSORBS_EXTRA` | تكلفة **أرخص شحنة واحدة** فقط — مثالك: 20 من أصل 45، والتاجر يتحمّل 25 |
| `FLAT_RATE` | `flat_rate_cents` |
| `FREE` | `0` |
| `FREE_ABOVE_THRESHOLD` | `subtotal ≥ free_above_cents ? 0 : fallback` |

ثم في جميع الأحوال: `charge = min(charge, max_customer_fee_cents ?? ∞)`.

**التوزيع على الشحنات:** `allocated_charge_cents` يوزّع رسم العميل على الشحنات بنسبة تكلفتها الفعلية (largest-remainder لتفادي فقد قرش). هذا ما يجعل تقرير الربحية لكل شحنة ممكنًا مع بقاء المجموع مساويًا لما دفعه العميل بالضبط.

**العميل يرى رقمًا واحدًا** — `Order.delivery_fee_cents` كما هو اليوم. التفصيل داخلي بحت (لوحة التاجر + تقارير الأدمن). لا تغيير في واجهة العميل.

**التقرير الذي يفتحه هذا:** "هامش الشحن" لكل متجر = Σ charge − Σ actual. تاجر يخسر على الشحن سيعرف ذلك للمرة الأولى.

---

## 8. الحالات الحرجة — القرارات المطلوبة

| الحالة | القرار المقترح |
|---|---|
| **مخزون غير كافٍ** | افحص وقت السلة على `available` **للمواقع المؤهّلة للأونلاين فقط** (إصلاح G7). ثم تحقّق ثانية داخل tx إنشاء الطلب. |
| **مواقع متعدّدة** | المرحلة 1 من الخوارزمية: موقع واحد يفوز دائمًا إن استطاع. |
| **تنفيذ جزئي** | Fulfillment لكل موقع، وكلٌّ يشحن مستقلًا. `Order.fulfillment_status` (موجود) يُعاد حسابه — منطقه جاهز في `computeFulfillmentStatus`. |
| **إلغاء الطلب** | قبل الشحن: `cancelReservation` **على موقع الـ fulfillment**، لا على الافتراضي (إصلاح G9). بعد إنشاء الشحنة: نادِ `provider.cancelShipment()` أولًا؛ إن رفض ← المرتجع هو المسار الوحيد. |
| **المرتجعات** | ارجع إلى `Fulfillment.location_id` **للقطعة نفسها** لتحديد وجهة الإرجاع، مع سماح للتاجر بتغييرها (مركز مرتجعات مخصّص). لا تستخدم الموقع الافتراضي أبدًا. |
| **الاستردادات** | مالية بحتة، منفصلة عن المخزون (`restock` flag موجود بالفعل في `returns` / `refunds`). ردّ رسم الشحن حسب السياسة؛ **الـ subsidy لا يُسترد** — التاجر تحمّله فعلًا. |
| **تقسيم الشحنات** | فقط عندما يعجز موقع واحد. `MAX_SPLITS = 3`. |
| **حجز المخزون** | حرّر `StockReservation` من الموقع الافتراضي: الحجز يصير **لكل موقع** بعد الـ allocation، أو يبقى مجرّدًا حتى الـ checkout ثم يُثبَّت. الـ CAS الحالي (`STOCK_RACE`) يبقى الضمان. |
| **الطلبات المتزامنة** | ثلاث طبقات: (1) `adjust()` CAS الموجود — يمنع oversell على مستوى الـ level؛ (2) `SELECT … FOR UPDATE` على أسطر `inventory_levels` المرشّحة داخل tx الـ allocation، بترتيب `location_id` ثابت لتفادي deadlock؛ (3) `IdempotencyRecord` (موجود) على `createOrder` و `createShipment`. |
| **تنفيذ غير ممكن أصلًا** | `AllocationPlan.unfulfillable` غير فارغ ← ارفض الـ checkout برسالة واضحة **قبل** الدفع، لا بعده. |

---

## 9. تصميم الـ GraphQL API

```graphql
# ── Queries ──────────────────────────────────────────────────────────
allocationPreview(input: AllocationPreviewInput!): AllocationPlan!
shippingRates(input: ShippingRatesInput!): [ShippingRateOption!]!
fulfillment(id: ID!): Fulfillment
orderFulfillments(order_id: ID!): [Fulfillment!]!
shipment(id: ID!): Shipment
shopShippingPolicy: ShopShippingPolicy!                  # X-SHOP scoped
shippingProviderAccounts: [ShippingProviderAccount!]!    # أسرار مقنّعة دائمًا

# ── Mutations (vendor) ───────────────────────────────────────────────
allocateOrder(order_id: ID!, strategy: AllocationStrategyInput): [Fulfillment!]!
reallocateFulfillment(fulfillment_id: ID!, location_id: ID!): Fulfillment!
createShipmentForFulfillment(input: CreateShipmentInput!): Shipment!   # يحتاج Idempotency-Key
cancelShipment(id: ID!): Shipment!
updateShopShippingPolicy(input: ShopShippingPolicyInput!): ShopShippingPolicy!
upsertShippingProviderAccount(input: ShippingProviderAccountInput!): ShippingProviderAccount!
verifyShippingProviderAccount(id: ID!): VerifyResult!
mapProviderLocation(input: MapProviderLocationInput!): ShippingProviderLocation!

# ── الأنواع المالية — صريحة ولا تقبل اللبس ───────────────────────────
type Shipment {
  id: ID!
  fulfillment_id: ID!
  actual_cost: Float!          # وحدات كبرى (fromCents) — اتّساقًا مع بقية الـ API
  allocated_charge: Float!
  currency: String!
  tracking_number: String
  status: ShipmentStatus!
}

type OrderShippingBreakdown {   # لوحة التاجر فقط — العميل لا يراها
  actual_cost: Float!
  customer_charge: Float!
  merchant_subsidy: Float!
}
```

**قواعد ملزمة:** كل شيء تحت `X-SHOP` + `ShopOwnershipGuard`. صلاحيات جديدة: `manage_fulfillments` و `manage_shipping_providers` — وانتبه أن `PermissionsGuard` يطابق بـ `.some()` لا `.every()`. الأسرار **لا تُعاد أبدًا** — قناع فقط، ومجموعة `touched` تحدّد ما يُرسل (نفس نمط شاشة `/integrations` في الأدمن).

---

## 10. خطة التنفيذ — مرتّبة حسب الأولوية

### المرحلة 0 — إصلاحات نزاهة (قبل أي ميزة) 🔴

هذه أخطاء **قائمة اليوم**، ومستقلة عن كل ما سبق:

- [ ] `syncRollup` يستثني المواقع التي `fulfills_online_orders = false` — وإلا يبيع النظام مخزونًا لا يستطيع شحنه (G7).
- [ ] `createFulfillmentTx`: إزالة `catch { locationId = null }` — الفشل يجب أن يرمي لا أن يُبتلع (G2).
- [ ] `InventoryService.fulfill()`: `committed < qty` يرمي أو يكتب صفّ انحراف صريح بدل `logger.warn` صامت (G2).
- [ ] مراجعة أثر `ENABLE_STOCK_RESERVATION="true"` (مفعّل في الإنتاج) على المتاجر متعددة المواقع الحالية.

### المرحلة 1 — الأساس (2–3 أيام)

- [ ] `Fulfillment.location_id` ← FK إلزامي + `shop_id` + `FulfillmentStatus` enum.
- [ ] `Shipment.fulfillment_id` + `ShipmentLineItem` + `ShipmentPackage`؛ ترحيل الشحنات القائمة (كل واحدة ← fulfillment ضمني على الموقع الافتراضي).
- [ ] الأعمدة المالية الثلاثة على `Shipment` + التجميع على `Order`.
- [ ] أبعاد المنتج (`length_mm` / `width_mm` / `height_mm`).

### المرحلة 2 — Allocation Engine (3–4 أيام)

- [ ] `src/fulfillment-allocation/` — دالة نقيّة + اختبارات وحدة **قبل** أي ربط.
- [ ] المرحلة 1 (موقع واحد) ثم Greedy split ثم دالة الترجيح.
- [ ] ربطها في `createOrder` داخل tx مع `FOR UPDATE` بترتيب ثابت.
- [ ] استبدال مواضع `getOnlineFulfillingLocation` الأربعة — بما فيها **مسار المرتجعات** (G9).

### المرحلة 3 — سياسة الشحن والمال (2 أيام)

- [ ] `ShopShippingPolicy` + `ShippingQuote`.
- [ ] تطبيق السياسة في `checkout.verify()`؛ توزيع `allocated_charge_cents` بـ largest-remainder.
- [ ] تجميد الـ quote واحترامه عند اختلاف الخطة وقت إنشاء الطلب.

### المرحلة 4 — طبقة المزوّدين + OTO (4–5 أيام)

- [ ] `ShippingProvider` interface + registry (نسخ نمط `integrations/provider-registry.ts`).
- [ ] `ShippingProviderAccount` + `ShippingProviderLocation` + التشفير عبر `SecretCryptoService`.
- [ ] `OTOProvider`: rate / createShipment / cancel / track / parseWebhook (+ تحقق توقيع).
- [ ] Webhook endpoint يعيد استخدام `ProcessedWebhookEvent` لمنع التكرار.
- [ ] Fallback إلى `ShippingZone` عند غياب مزوّد مفعّل.

### المرحلة 5 — الواجهات (3–4 أيام)

- [ ] Vendor: شاشة تنفيذ الطلب (fulfillments، الشحنات، الملصقات، التتبّع)؛ إعدادات الشحن؛ ربط مواقع المزوّد. **يلزم شريط الحفظ السياقي الإلزامي** في كل شاشة تحرير.
- [ ] Storefront: "يُشحن على دفعتين" + تتبّع لكل شحنة.
- [ ] Admin: تقرير هامش الشحن عبر المنصّة.

### المرحلة 6 — مزوّدون إضافيون

- [ ] SPL / Aramex / DHL — **adapter فقط**. إن لزم تعديل أي ملف خارج `src/shipping-providers/`، فالـ abstraction فشل وهذا هو اختباره الحقيقي.

---

## 11. مبادئ يجب ألّا تُكسر

- **Multi-tenant isolation** — كل استعلام مقيّد بـ `shop_id`؛ `ShopHeaderGuard` + `ShopOwnershipGuard` على كل عملية جديدة.
- **Idempotency** — `createShipment` و `allocateOrder` تتطلّبان `Idempotency-Key`؛ الجدول موجود.
- **Transactional reservation** — الحجز والـ allocation والـ commit في معاملة واحدة، بترتيب أقفال ثابت.
- **Server-authoritative pricing** — العميل **لا يرسل** رسم شحن أبدًا. `ShippingQuote` هو الحقيقة.
- **Provider abstraction** — `grep -r "oto" back-end/src/orders back-end/src/inventory` يجب أن يبقى فارغًا إلى الأبد.
- **Domain separation** — `allocation` لا يستورد `shipping-providers`؛ يستقبل التسعيرات مُحقونة.
- **معرّفاتنا هي الأساس** — `external_location_id` يعيش في جدول الربط فقط، ولا يظهر كمفتاح في أي مكان آخر.

---

## 12. المخاطر

| الخطر | التخفيف |
|---|---|
| ترحيل `Shipment` يكسر بيانات قائمة | ترحيل يدوي: كل شحنة ← fulfillment ضمني على الموقع الافتراضي. نفّذه على نسخة أولًا. |
| اختلاف خطة الـ allocation بين `verify` و `createOrder` | الـ quote مجمّد يفوز؛ الفرق يصير subsidy. لا تغيير سعر بعد الدفع. |
| فشل أو بطء OTO في مسار الـ checkout | timeout قصير + fallback إلى `ShippingZone`. **لا تجعل الـ checkout يعتمد على استجابة طرف ثالث.** |
| Deadlock تحت التزامن | ترتيب أقفال ثابت بـ `location_id` تصاعديًا؛ إعادة محاولة مرة واحدة على `STOCK_RACE`. |
| الأداء: قراءة كل المستويات لكل تسعيرة | استعلام واحد مفهرس على `(location_id, product_id)` — الفهارس موجودة. Cache للتسعيرات بـ TTL قصير. |
