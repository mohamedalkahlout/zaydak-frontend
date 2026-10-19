# Multi-Location Fulfillment + Shipping — ما تبقّى من الخطة

**Last updated:** 2026-08-24
**الخطة الأصلية:** [multi-location-fulfillment-and-shipping.md](multi-location-fulfillment-and-shipping.md)
**الحالة:** PHASE 0 → 7 مُنجزة — **PHASE 6 (OTO) شُحنت 2026-08-24** (adapter + webhook + أبعاد المنتج، من وثائق OTO الرسمية؛ يتبقى e2e على sandbox وتسجيل الويبهوك — انظر TODO) · الإنتاج يتحدّث تلقائيًّا مع النشر عبر `prisma db push`

---

## 1. أين وصلنا

| Phase | الحالة | ما شُحن |
|---|---|---|
| **0 — Inventory correctness** | ✅ | ترشيح `syncRollup` على المواقع المؤهّلة · `fulfill()` يرمي `INSUFFICIENT_COMMITTED_STOCK` · `createFulfillmentTx` لا يبتلع فشل الموقع · توحيد predicate الحجز مع الـ resolver · المرتجع يُقيَّد على موقع الشحن الفعلي · حارس إشعار "عاد للمخزون" |
| **1 — Fulfillment data integrity** | ✅ | `Fulfillment.location_id` FK + `shop_id` + فهارس · `Shipment.fulfillment_id` · `ShipmentLineItem` · سدّ ثغرة tenancy في `createShipment` · **الـ migration مطبَّق على الإنتاج** · **`location_id` NOT NULL مقفول** |
| **2 — Allocation Engine** | ✅ | `src/fulfillment-allocation/` — دالة نقيّة + خدمة · 38 اختبارًا · مُتحقَّق منها على بيانات حقيقية |
| **3 — Checkout integration** | ✅ | `verify()` يشغّل المحرّك · `fulfillment { feasible, location_count, requires_split }` · سبب `unfulfillable_online` |
| **4 — Reservation & execution** | ✅ | `createOrder` يعيد تشغيل التخصيص **داخل** المعاملة · `SELECT … FOR UPDATE` على الأسطر المرشّحة بترتيب `(location_id, id)` · `Fulfillment` يُكتب من الخطة — سطر لكل موقع · `@Idempotent('createOrder')` (كان موجودًا أصلًا) |
| **5 — Shipping providers** | ✅ | `Shop.shipping_mode` · واجهة المزوّد + سجلّ · حسابات لكل متجر مشفّرة · ربط المواقع · `ManualProvider` · طرود وأحداث تتبّع · `cancelShipment` و`refreshShipmentTracking` · واجهة التاجر · إزالة `provider_response` من GraphQL · **مطبَّق محليًا وعلى الإنتاج** |
| **7 — Shipping economics** | ✅ | عمودان على `Shipment` (`actual_cost_cents`, `cost_source`) · `ProviderShipment.costCents` · `setShipmentActualCost` · `orderShippingEconomics` · اشتقاق نقيّ مُختبَر · **مطبَّق محليًا وعلى الإنتاج** |

**الحالة الحالية للفحوصات:** 4118 اختبارًا / 246 suite خضراء في الـ back-end · 543 اختبارًا / 43 suite في vendor · typecheck عند الـ baseline (167، صفر جديد) · lint صفر أخطاء في الكود الجديد · `check:di` و`schema:check` سليمان · الثلاثة تطبيقات typecheck خضراء.

---

## 2. الفجوة الحقيقية اليوم — قبل أي phase جديدة

هذه ليست بنودًا تجميلية، بل ما يجعل ما بُني **غير مكتمل وظيفيًا**:

### 2.1 الخطة لا تُحفَظ ولا تُحجَز 🔴

`checkout.verify()` يحسب خطة تخصيص صحيحة **ثم يرميها**. وعند `createOrder`:

- **لا يُعاد تشغيل التخصيص** — الخطة استشارية وقت الـ verify ولا يتحقّق منها أحد وقت الكتابة، فالمخزون قد يتغيّر بينهما.
- **لا تُكتب `Fulfillment` من الخطة** — إنشاء الطلب ما زال يحلّ **موقعًا واحدًا** بالطريقة القديمة (`getOnlineFulfillingLocation`).
- **لا شيء يحجز** — متسوّقان قد يُخبَران كلاهما بأن آخر قطعة له.

أي أن المحرّك **يخبر العميل بالحقيقة ثم لا يُنفّذها**. هذا لبّ PHASE 4.

### 2.2 `Product.quantity` له كاتبان بدلالتين مختلفتين 🟠

`syncRollup` (مجموع مطلق) و`StockReservationService.confirm()` (حساب تفاضلي). يتوافقان اليوم بالصدفة فقط — لأن إنشاء الطلب ينفّذ الخصم القديم أولًا ثم `syncRollup` يكتب فوقه. **يجب توحيدهما قبل أن يعتمد الحجز عليهما.**

---

## 3. PHASE 4 — Reservation ✅

**مُنجزة.** التسليمات الأربعة:

1. ✅ **إعادة تشغيل التخصيص داخل معاملة `createOrder`** — `recordSaleAdjustments` يستدعي `planForLines(..., tx)`، فالأسطر التي يقرؤها هي نفسها التي يخصمها.
2. ✅ **قفل تشاؤمي** — `planForLines({ lock: true })` يصدر `SELECT … FOR UPDATE` على كل سطر `inventory_levels` مرشّح، **بترتيب `(location_id, id)`** كقاعدة منع deadlock. طلبان على آخر قطعة يصطفّان بدل أن يخطّطا كلاهما على `available = 1` ويُرمى الخاسر `STOCK_RACE` بينما موقع آخر كان يكفيه. القفل خارج معاملة **مرفوض صراحةً** — يُحرَّر باللحظة نفسها فيبدو حماية وهو ليس كذلك.
3. ✅ **`Fulfillment` من الخطة** — `createFulfillmentTx` يقرأ قيود SALE بـ `reference_id = orderId` ويُنشئ صفًّا لكل موقع.
4. ✅ **`Idempotency-Key`** — `@Idempotent('createOrder')` كان مطبَّقًا على الـ resolver أصلًا. **تصحيح للوثيقة السابقة التي عدّته ناقصًا.**

**آلية CAS باقية كما هي** — القفل يضيّق النافذة ولا يستبدل الحارس الذي يرفض كتابة مستوى سالب.

### ما لم يُنفَّذ عمدًا: الحجز لا يخصم `available`

بند "ربط كل reservation بـ `locationId` من الخطة" **غير قابل للتنفيذ كما كُتب**: الحجز يُنشأ عند الإضافة إلى السلة، والخطة تعتمد على عنوان الوجهة الذي لا يوجد بعد.

لكن الفحص كشف ما هو **أدقّ وأهمّ**:

> `bumpCommitted` يرفع `committed` ولا يخفض `available`. فالمحرّك — الذي يقرأ `available` — **لا يرى حجوزات السلال إطلاقًا** على مستوى الموقع. الحماية الوحيدة اليوم هي `Product.reserved_quantity` على مستوى المنتج، لا الموقع.

**والإصلاح البديهي خاطئ** (فُحص 2026-08-22): جعل الحجز `available -= q` **يحسب الحجز مرّتين**، لأن `syncRollup` يكتب `Product.quantity = SUM(available)` ثم يفحص حارس البيع الزائد و`reserveInternal` كلاهما `quantity - reserved_quantity`. متجر بـ5 قطع وواحدة في سلة سيعرض 3.

فالمسألة **قرار تصميم**: إمّا تبقى الحجوزات في `reserved_quantity` ويتعلّم **المحرّك** خصمها لكل موقع، وإمّا تنتقل إلى `available` ويتوقّف خصم `reserved_quantity` في كل مكان. الاختيار الأعمى يخاطر ببيع زائد.

**قياس على الإنتاج: صفر حجوزات حيّة** (36 صفًّا كلها محرَّرة أو منتهية) — فالتبديل نفسه آمن متى اتُّخذ القرار. → حُسم ونُفِّذ 2026-08-23 (انظر §7).

**قرار ما زال مطلوبًا منك:** إذا اختلفت الخطة بين `verify` و`createOrder` (تغيّر المخزون بينهما) — نحترم خطة الـ verify ونتحمّل الفرق، أم نرفض الطلب ونطلب إعادة المراجعة؟

---

## 4. PHASE 5 — Shipping abstraction ✅

**مكتملة.** التصميم المعتمَد في [multi-location-phase-5-proposal.md](multi-location-phase-5-proposal.md)، والسلوك الفعلي موثَّق في [`docs/features/shipping-providers.md`](../../back-end/docs/features/shipping-providers.md).

**ما شُحن:** `Shop.shipping_mode` (enum صريح، افتراضه `MERCHANT_MANAGED`) · واجهة `ShippingProvider` بستّ دوال · سجلّ المزوّدين · `ShippingProviderAccount` مشفّرة بـ AAD مع قناع وverify وenable/disable · `ShippingProviderLocation` (جدار المعرّفات الخارجية) · `ManualProvider` · `ShipmentPackage` · `ShipmentTrackingEvent` · أربعة أعمدة على `Shipment` · **إزالة `provider_response` من GraphQL** · اختبار CI يمنع تسرّب مفردات الناقل إلى النواة.

**أُنجز لاحقًا (2026-08-22):**
- **الـ migration مطبَّق على القاعدة المحلية**، ومعه migration‑ا PHASE 1 اللذان لم تكن المحلية قد استلمتهما أصلًا (`fulfillments.location_id` كانت ما زالت nullable هناك بينما الإنتاج مقفول). المحلية الآن مطابقة: 17 متجرًا `MERCHANT_MANAGED`، و4 شحنات تُقرأ كـ manual قديم، وبلا backfill. **الإنتاج لم يُمَسّ.**
- **واجهة التاجر**: `ShippingProvidersSection` فوق بطاقة المناطق، والمناطق **تبقى ظاهرة في الوضعين**. مبدّل الوضع يعرض خيارين لا ثلاثة، والانتقال لوضع المزوّد **معطَّل حتى ينجح verify** — مطابقةً لرفض الخادم، فلا يَعِد الزرّ بما سيرفضه الحفظ.
- **`cancelShipment` و`refreshShipmentTracking`**: الإلغاء يُبلغ الناقل أولًا ثم يكتب الصفّ، والتحديث **يُلحِق** ولا يستبدل ويتخطّى ما سُجِّل بنفس `(status, occurred_at)`.

**ما تبقّى:** الإنتاج فقط — بقرارك.

**الـ delta:** enum واحد + 4 جداول + 5 أعمدة، **إضافي 100%** فيمرّ على `prisma db push` بلا backfill. الملف: `back-end/prisma/migrations/manual/2026-08-21-shipping-providers.sql`.

**المفهوم المركزي:** `Shop.shipping_mode` (`MERCHANT_MANAGED` | `SHIPPING_PROVIDER`، افتراضه الأول) **قرار عمل يختاره التاجر**، والمزوّد (`manual` · `oto` · …) تنفيذ ينتج عنه. `MERCHANT_MANAGED` تُحَلّ إلى `manual` لكنها **ليست ارتدادًا**: متجر في هذا الوضع يبقى يدويًا حتى مع حساب OTO مفعَّل، ومتجر في وضع المزوّد بلا حساب صالح **يرمي** بدل أن يشحن يدويًا بصمت.

**الـ checkout لا يتغيّر في أي من الوضعين** — ما يدفعه العميل يبقى من `ShippingZone`/`ShippingRule`، ولا يُستدعى أي مزوّد عند الشراء.

**تصحيح للوثيقة السابقة:** `Product` **يحمل** `weight_grams` و`hs_code` و`country_of_origin` أصلًا. الأبعاد وحدها ناقصة، وأُجّلت إلى PHASE 6 لأن OTO وحدها تحتاجها.

**اكتشاف أمني عولج:** `Shipment.provider_response` كان **مُعرَّضًا عبر GraphQL** والعمود فارغ — فما إن يكتب فيه مزوّد حتى تتسرّب حمولته الخام. **أُزيل من `ShipmentEntry`** قبل أن يكتب فيه أي مزوّد. العمود باقٍ ويُكتَب للدعم وإعادة التشغيل، ولا تُرجِعه أي عملية.

**قاعدة ملزمة:** `grep -r "oto" back-end/src/orders back-end/src/inventory back-end/src/fulfillment-allocation` يجب أن يبقى فارغًا.

---

## 5. PHASE 6 — OTO

**شُحنت (2026-08-24)،** ثم أُعيد تشكيل ملكيّتها في PHASE 6-B: الاعتماد صار للمنصّة لا للتاجر — حساب OTO واحد يحجز لكل المتاجر (نموذج سلة/زد)، والتاجر يختار الناقلين ويربط مواقعه فقط. التفاصيل في [`multi-location-phase-6-central-oto-proposal.md`](multi-location-phase-6-central-oto-proposal.md).

القواعد الثلاث التي وُضعت هنا قبل التنفيذ صمدت كلّها ولم يُخالَف أيّ منها:

- وثائق OTO قُرئت من مصدرها — **بلا تخمين** لأشكال الطلب/الاستجابة (§0.5-أ في وثيقة 6-B).
- `external_location_id` ما زال يعيش في جدول الربط وحده، ولا يصير مفتاحًا في أي مكان آخر — و`domain-isolation.spec.ts` يحرس ذلك في CI.
- `ProcessedWebhookEvent` هو ما يمنع تكرار الـ webhooks، بالمفتاح `(provider, event_id)` نفسه.

---

## 6. PHASE 7 — Shipping economics ✅

**مُنجزة.** التصميم المعتمَد في **[multi-location-phase-7-proposal.md](multi-location-phase-7-proposal.md)**.

**الـ delta:** عمودان nullable على `Shipment` فقط (`actual_cost_cents`, `cost_source`) — إضافي، بلا backfill، بلا جدول جديد. `customerShippingCharge` هو `Order.delivery_fee_cents` الموجود، و`merchantShippingSubsidy` **مشتقّ لا يُكتب**.

**ما نُفِّذ مسبقًا (بلا migration):** `shipping-economics.helper.ts` — الاشتقاق النقيّ و11 اختبارًا. يثبّت ثلاثة أشياء تُغفَل عادةً: خصم رسم التوصيل الملغى، والجمع على مستوى **الطلب** لا الشحنة (طلب مقسّم = رسم واحد مقابل فاتورتين)، و`NULL` ≠ صفر (فاتورة لم تصل ليست شحنًا مجانيًّا).

**ما شُحن:**
- **العمودان** `Shipment.actual_cost_cents` و`cost_source` (`provider` | `manual`). لا عمود على `Order` — الدعم مشتقّ عند القراءة.
- **`ProviderShipment.costCents`** على واجهة PHASE 5. `manual` يُرجع `null` دائمًا ولا يخترع صفرًا.
- **`setShipmentActualCost`** — التاجر يُدخل ما دفعه بيده، فهامش الشحن يعمل **بلا ناقل حقيقي**.
- **`orderShippingEconomics(order_id)`** — استعلام مستقلّ لا حقل على `OrderEntry`: العميل يقرأ ذلك النوع، والصلاحية على الاستعلام هي الحارس. ويوفّر join على مسار قائمة الطلبات الساخن.
- **الحجب**: `mapEntry` يأخذ `withCost` **بالاشتراك لا بالاستثناء** — مستدعٍ جديد ينساه يُظهر أقلّ لا أكثر.

**الترحيل مطبَّق محليًا (2026-08-22)** عبر `npm run migrate:local -- 2026-08-22` — 4 شحنات كلّها «تكلفة غير معروفة»، ولا صفر مزروع. **الإنتاج لم يُمَسّ.**

المطلوب أصلًا كان فصل ثلاثة مفاهيم:

```
actualShippingCost      ← حقيقة من المزوّد
customerShippingCharge  ← يُثبَّت وقت الـ checkout
merchantShippingSubsidy ← مشتقّ: max(0, actual − charge) — لا يُكتب يدويًا
```

**تعليمتك:** افحص `ShippingZone` و`ShippingRule` و`checkout.verify` و`Order.delivery_fee_cents` أولًا، ثم **أقلّ تغيير ممكن**، ولا schema جديد إن أمكن تمثيله بالموجود. **اقترح schema delta وانتظر مراجعتك قبل أي migration.**

**ما نعرفه مسبقًا:** `ShippingZone` مربوط بـ `shop_id` لا بالموقع — فلا توجد تكلفة لكل موقع اليوم، وهذا ما جعل "التكلفة" غائبة من مُرجِّح PHASE 2.

---

## 7. ديون مفتوحة من المراحل المنجزة

### مخزون
- [ ] **Backfill لـ `products.quantity` / `variation_options.quantity`** — ترشيح PHASE 0 يُطبَّق كسولًا (عند أول تعديل لكل منتج)، فالمتاجر ذات مخزون مستودعي تحمل رقمًا أعلى من الحقيقة حتى ذلك الحين.
- [ ] **الطلبات القديمة لم تعد قابلة للتنفيذ** إذا لم يُسجَّل لها `committed` — `fulfillOrder` يرمي `INSUFFICIENT_COMMITTED_STOCK`. قرار مطلوب: هل يحتاج المشغّلون مسار تجاوز؟
- [x] توحيد كاتبَي `Product.quantity` (بند 2.2) — `inventory-sql.ts` يملك التعبيرات، و`confirm()` لم يعد يكتب `quantity`/`in_stock`.
- [x] **حجوزات السلة صارت مرئية للمحرّك (2026-08-23) — القرار اتُّخذ ونُفِّذ.** بقيت الحجوزات في `reserved_quantity` (+ مرآة `committed`) ولم يُلمس `available` — فلا عدّ مزدوج — و**المحرّك** صار يخصم الحجوزات النشطة من رؤيته في الذاكرة: `planForLines` يقرأ `StockReservation` (غير المحرَّرة وغير المنتهية)، يخصم الموقَّعة على `location_id` من رفّها المجمَّد، وصفوف NULL القديمة من أعمق رفّ، ويستثني سلة المستدعي نفسه (`excludeCartId` — `verifyCheckout` كسب `cart_id`، وإنشاء الطلب يستثني سلته لأن `releaseAll` يجري بعد التخطيط في نفس الـ transaction). حكم verify يطابق أخيرًا حارس `quantity - reserved_quantity` وقت الطلب. التحليل الأصلي أدناه محفوظ للسجل: الحجز يرفع `committed` ولا يخفض `available`، والمحرّك يقرأ `available`. لكن جعل الحجز يخفض `available` **يحسب الحجز مرّتين**: `syncRollup` يكتب `Product.quantity = SUM(available)`، ثم يفحص حارس البيع الزائد `quantity - reserved_quantity`. متجر بـ5 قطع وواحدة في سلة سيعرض 3.
  فهذا **قرار تصميم لا رقعة**: إمّا تبقى الحجوزات في `reserved_quantity` ويتعلّم **المحرّك** خصمها لكل موقع، وإمّا تنتقل إلى `available` ويتوقّف خصم `reserved_quantity` في كل مكان. الاختيار الأعمى يخاطر ببيع زائد.
  **قياس على الإنتاج 2026-08-22: صفر حجوزات حيّة** (36 صفًّا كلها محرَّرة أو منتهية). فالتبديل نفسه آمن متى اتُّخذ القرار.

### Schema
- [ ] **`Fulfillment.status` ما زال `String`** — الـ enum مؤجّل لأن العمود يحمل `'success'` والـ cast لـ enum بحروف كبيرة يُفشل الـ deploy. مكانه PHASE 4 حين يصير الـ fulfillment قرارًا لم يُشحن بعد.
- [ ] **`Shipment.fulfillment_id` ما زال nullable** — الجديد يحمله دائمًا، لكن الـ backfill لا يربط إلا الطلبات ذات fulfillment واحد.
- [x] **`ShipmentPackage` مضاف** ومعه `ShipmentTrackingEvent` — PHASE 5.
- [ ] **أبعاد المنتج غير موجودة** (`length_mm`/`width_mm`/`height_mm`) — أُجّلت إلى PHASE 6: لا يحتاجها إلا ناقل حقيقي للوزن الحجمي، و`ShipmentPackage` يقبل أبعادًا يدوية حتى ذلك. الوزن و`hs_code` و`country_of_origin` موجودة.

### محرّك التخصيص
- [ ] **لا عمود `priority` على `InventoryLocation`** — "أولوية التاجر" مُقارَبة بـ `is_default`، وهو راية واحدة لا ترتيب.
- [ ] **لا إحداثيات** — القرب طبقة تقريبية لا مسافة.
- [ ] **الـ greedy split غير مُثبَت الأمثلية** — مقبول عند سقف 3؛ راجعه إن ارتفع `MAX_SPLITS`.

### واجهات
- [x] **Storefront يعرض `requires_split` (2026-08-23)** — سطر "سيصل طلبك في أكثر من شحنة" تحت مبدّل طريقة الشحن في checkout.
- [x] **اختيار طريقة الشحن (2026-08-23)** — `verifyCheckout` يعيد كل خيارات الوجهة مسعَّرةً (`shipping_options`)، والعميل يختار (`shipping_rule_id`: الـ quote يستبدل الميت بالافتراضي ويصرّح، وإنشاء الطلب يرفضه)، والطريقة تُجمَّد على الطلب (`Order.shipping_method`). المسودات تحمل `shipping_override_cents` وعنوان شحن في نموذج التاجر. المشتري يرى شحناته (`OrderEntry.shipments` الآمنة) وسلة المتجر تقرأ `product_type` فتطابق مسند الخادم.
- [x] **شاشة الشحنات في لوحة التاجر (2026-08-22)** — بطاقة على تفاصيل الطلب **مجمَّعة حسب الـ fulfillment أي حسب الموقع**، مع سجلّ التتبّع ومصدره، والطرود والوزن، والملصق، والإلغاء والتحديث، وحوار التكلفة، وشريط المحصَّل/المدفوع/الفرق.
- [ ] لا تقرير هامش شحن في الأدمن.

### بيئة وتشغيل
- [x] **قاعدة التطوير المحلية لحقت الإنتاج (2026-08-22)** — طُبّقت عليها migrations الـ PHASE 1 (بما فيها قفل `location_id`) وPHASE 5.
- [ ] **`prisma db push` لا يعمل محليًا** — drift قديم في enum `BillingUnit` (`byte`). **الإنتاج سليم** — تحقّقتُ، لا يحمل هذا الـ drift.
- [ ] **`.env` يوجّه كل أوامر Prisma إلى Neon البعيدة** — `prisma.config.ts` يقرأ `.env` فقط ولا يقرأ `.env.development`. الـ seed يرفض أي host غير loopback، لكن بقية الأوامر بلا حماية. يستحق npm script يثبّت الرابط المحلي.

---

## 8. أمان — خارج الخطة لكنه يسبقها 🔴

- [x] **مسار التدوير صار يغطّي الجدولين (2026-08-22)** — `SecretRotationService` كان يعيد تشفير `integration_configs` وحدها، بينما PHASE 5 أضافت `shipping_provider_accounts` تحت نفس المفتاح. جدول متروك خارج التدوير **ليس تدويرًا جزئيًّا بل خسارة كاملة صامتة**: السجلّ يقول «اكتمل»، فيحذف المشغّل المفتاح السابق بناءً عليه، وتصير اعتمادات كل تاجر غير قابلة للقراءة. مُصلَح ومُثبَّت باختبارات، ودالّة الـ AAD صارت مُصدَّرة بتعريف واحد.
- [ ] **تدوير الأسرار.** الأسرار الحيّة لُصقت في المحادثة بتاريخ 2026-08-21، **وهي تكرار لحادثة 2026-08-09** المسجّلة أصلًا في `TODO.md` مع خطوات مرتّبة في [docs/go-live-checklist.md](../go-live-checklist.md). الأولوية حسب حجم الضرر: `SECRETS_ENCRYPTION_KEY` (يفكّ تشفير كل اعتمادات التكاملات) ← كلمة مرور Neon ← `JWT_SECRET` ← Redis ← `APP_SECRET` ← مفاتيح المزوّدين.
  **ترتيب ملزم:** `SECRETS_ENCRYPTION_KEY` يُضبط في Render **قبل** تدوير `APP_SECRET` — لأنه يرتدّ إليه، وتدوير `APP_SECRET` أولًا يجعل كل صفّ في `integration_configs` غير قابل للقراءة نهائيًا.
- [ ] **`NODE_ENV=development` على الخادم الحيّ.** تجاوز الـ OTP معطّل **بالصدفة فقط**: الحارس يشترط `ENABLE_DEBUG_OTP === '1'` والقيمة الحالية `true`. "تصحيحها" إلى `1` يفتح تجاوز التحقق بترويسة `x-debug-mode`. اضبط `NODE_ENV=production` واحذف علمَي الـ debug.
- [ ] **روابط localhost على الحيّ** — `FRONTEND_URL` و`SHORT_DOMAIN` و`UPLOAD_BASE_URL` تشير إلى `localhost`، فروابط الـ magic link والروابط المختصرة وملفات الرفع مكسورة.

---

## 9. الترتيب الموصى به

1. ~~PHASE 0 → 5~~ · ~~توحيد كاتبَي `Product.quantity`~~ — منجزة.
2. **الأمان (بند 8)** 🔴 — موثّق كخطوات مرتّبة في [go-live-checklist](../go-live-checklist.md) وينتظر تنفيذك على Render. لا يعتمد على شيء ويتفاقم بالانتظار، **وهو شرط قبلي لـ PHASE 6**: اعتمادات الناقل ستُشفَّر بـ `APP_SECRET` ما دام `SECRETS_ENCRYPTION_KEY` غير مضبوط.
3. **نشر PHASE 5 على الإنتاج** — الـ migration إضافي ومُختبَر على Postgres حقيقي.
4. **PHASE 7** (التسعير) — تسبق 6 عمدًا: فصل التكلفة/الرسم/الدعم لا يحتاج ناقلًا حقيقيًا، وقيمته التجارية فورية.
5. **PHASE 6** (OTO) — بعد استقرار الـ abstraction، ومعها أبعاد المنتج.
6. **شاشة الشحنات في لوحة التاجر** — سجلّ التتبّع يُكتب الآن ولا شيء يعرضه.
7. بقية ديون الـ schema والواجهات بالتوازي.
