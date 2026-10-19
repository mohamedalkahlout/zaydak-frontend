# التحويل البنكي اليدوي — خطة إضافة طريقة دفع غير متّصلة

**Last updated:** 2026-09-07
**الحالة:** وثيقة تاريخية. مسار التحويل البنكي للعميل **شُحِن** في `shop-payments/` و`bank-transfers/` (`payment_settlement = merchant_direct`). `Balance.payment_info` كوجهة صرف مستحقّات التاجر جزء من حلقة السحب المجمّدة (D26) — لا تُطوَّر. لا تُقرأ بقية هذه الخطة كعمل مفتوح.
**المصدر:** مواصفة REST من نظام Laravel آخر، **مُعاد التعبير عنها** بأعراف هذا المستودع (NestJS + GraphQL + Prisma). المواصفة الأصلية تفترض أشياء غير موجودة هنا — القسم ٢ يعدّها واحدة واحدة.
**الوحدة الجديدة:** `back-end/src/bank-transfers/`
**التوثيق المطلوب عند التنفيذ:** `back-end/docs/features/bank-transfers.md` + `back-end/docs/features/api/bank-transfers.md`
**المراجعة:** خضع التصميم لمراجعة خصمية على ثلاثة محاور (صحّة مقابل الكود · أمن ومال · اكتمال). أُصلح **حاجزان** — كشف الـIBAN لمنادٍ غير مصادَق (§6.1) واعتماد تحويل على طلب مُلغى (§7.6) — وثلاث ثغرات تفويض (§12.1–12.3)، وجُمِّدت الواجهات المتنازع عليها في §3.11.

---

## 1. الخلاصة التنفيذية

طريقة دفع **ثالثة** بجانب الدفع عند الاستلام والبوّابات الإلكترونية: المتجر ينشر حساباته البنكية، المشتري يحوّل بنفسه من تطبيق بنكه، يرفع الإيصال، والمتجر يوافق أو يرفض. **لا بوّابة دفع في المنتصف**، فلا شيء يعلّم الطلب مدفوعًا حتى يقرّر إنسان.

الخبر الجيّد أن **النصف الصعب مبني أصلًا**، وأكبر دليل على ذلك أنّ القيمة التي تحتاجها هذه الميزة موجودة في الكود منذ كُتب الـenum ولم يكتبها شيء قط:

```ts
// back-end/src/orders/types/order-enums.ts:33
AWAITING_APPROVAL = 'payment-awaiting-for-approval',
```

هي في `lookups.service.ts:205`، ولها تسميتان عربية وإنجليزية في `i18n/{en,ar}/lookup.json:108`، وتُشتقّ أصلًا إلى `FinancialStatus.AUTHORIZED` في `orders.service.ts:1288`. **عضو معلّق ينتظر هذه الميزة بالضبط.** ولا نحتاج `PaymentStatus` جديدة — وهذا أكثر خطأ محتمل هنا.

كذلك: نمط «مطالبة يقدّمها المشتري ويبتّ فيها المتجر» موجود ومُختبَر في `returns/` و`refunds/`، ونمط القفل تحت `SELECT … FOR UPDATE` موجود في `refunds.service.ts:617-651`، ونمط اللقطة المجمّدة (`snapshot`) موجود في `OrderProduct.variation_snapshot` و`Order.shipping_method`.

**والخبر السيّئ فجوة واحدة حقيقية:** لا يوجد في هذا المستودع **قرص خاص ولا رابط موقّع**. كل ما يُرفَع اليوم عامّ بالتعريف — `main.ts:207-214` يخدم شجرة `uploads/` كاملة بـ`Access-Control-Allow-Origin: *` وبلا أي حارس، والإنتاج يعمل على `STORAGE_DRIVER=bunnycdn` حيث الـpull zone يخدم منطقة التخزين **بأكملها**. وإيصال تحويل يحمل اسم شخص وIBAN وأرقام حسابه لا يمكن أن يمرّ من هذا المسار. هذا هو القسم ٨، وهو أخطر ما في الخطة.

**التقدير:** ٧ مراحل، ست منها مظلمة بالكامل (لا يراها أحد)، والمرحلة السابعة هي وحدها ما يظهر للمشتري.

---

## 2. ما تفترضه المواصفة الأصلية وغير موجود عندنا

هذا الجدول هو نصف الخطة. كل سطر فيه افتراض لارافيلي يكسر عند نقله حرفيًّا.

| ما تفترضه المواصفة | الواقع في هذا المستودع | البديل المعتمد |
|---|---|---|
| `PATCH /checkouts/:token` مع `bank_account_id` على صفّ checkout محفوظ | **لا يوجد `Checkout` model ولا token ولا صفّ**. `verifyCheckout` لا يكتب شيئًا، و`createOrder` يعيد اشتقاق كل شيء | الحساب يُختار وقت إنشاء الطلب، ويُجمَّد على `Order.payment_instructions` — §7.3 |
| «لا يُنشَأ payment intent — يُتخطّى خطّ أنابيب البوّابة» | **لا يوجد خطّ أنابيب أصلًا.** `createOrder` لا يلمس `PaymentIntent` إطلاقًا (صفر إشارات في الملف)؛ `createPaymentLink` نداء عميل **منفصل** | لا شيء يُتخطّى. الخطر معكوس: نداء `createPaymentLink` عرضًا يعيد كتابة `order.payment_gateway` إلى STRIPE — §7.4 |
| قرص خاص + `Storage::temporaryUrl(7 days)` | `StorageDriver` سطران: `put()` و`delete()`. لا قراءة، لا توقيع، لا علم visibility. و`@aws-sdk/s3-request-presigner` **غير مثبَّت** | `PrivateReceiptStore` جديد + توقيع HMAC خاصّ بنا + مسار خدمة خاصّ بنا — §8 |
| رفع ملف عبر نوع الإطار | **`graphql-upload` غير مثبَّت**، ولا `scalar Upload` في `schema.gql`. لكن `multer` + `@nestjs/platform-express` مثبّتان ويعملان في الإنتاج | مسار REST متعدّد الأجزاء، على شاكلة `attachments.controller.ts:34-67` |
| الكتالوج بأربع لغات عبر ملفات ترجمة الإطار | يوجد `src/i18n/en/` و`src/i18n/ar/` **فقط**، و`SUPPORTED = ['en','ar']` مثبّتة في `lang.decorator.ts:4`. و`tl()` يسقط بصمت `lang → en → المفتاح الخام` | الأسماء الأربع **داخل** سجلّ TS مع سقوط لكل بنك على حدة — §5 |
| `409 Conflict` جاهزة من الإطار | `AppException` فيه مصانع لـ401/403/404/422/500 فقط. لا `conflict()` ولا `CONFLICT` في `ErrorCode` | نضيف `AppException.conflict()` + رمزين — §6.4 |
| «موظّفو المتجر» يعملون على طابور المراجعة | **لا يوجد دور staff للمتجر.** `enum Role` هو `customer \| vendor \| admin \| super_admin`، و`StaffNotificationRecipient` بريد على قائمة لا حساب | «المتجر» = `shop.owner_id` عبر نمط `ownedShopIds()` + أدمن المنصّة |
| تحويل واحد لكل طلب | `Order.shop_id` **قابل للـnull**: سلّة متعدّدة المتاجر تكتب أبًا بلا `shop_id` وN أبناء | نرفض `BANK_TRANSFER` للسلال متعدّدة المتاجر — §3.6 |

---

## 3. القرارات المقفولة

كل قرار هنا: **ما هو / لماذا / ما رُفض**. من يخالف واحدًا منها لاحقًا يجب أن يقرأ سطر «لماذا» أوّلًا.

### 3.1 جدولان جديدان: `ShopBankAccount` و`OrderBankTransfer` — لا توسعة لـ`PaymentMethod`

`PaymentMethod` خاطئ بنيويًّا على أربعة أوجه: `user_id` إلزامي بـ`onDelete: Cascade` من User، لا `shop_id`، أعمدته على شكل بطاقة، وكل تابع في خدمته يرشّح بـ`user_id`. و`Balance.payment_info` هو وجهة **صرف** مستحقّات المتجر — مال يغادر المنصّة، ويُجرَّد من كل مشاهد ليس المالك في `mapShop`؛ بينما حسابات هذه الميزة يجب أن يقرأها **متسوّق مجهول** عند الدفع.

البادئة `Order`/`Shop` تطابق `OrderProduct` و`OrderCoupon` و`ShopTelegramBot` و`ShopShippingCarrier`. والاسم المجرّد `BankTransfer` في سوق متعدّد البائعين يُقرأ «تحويل من المنصّة إلى البائع»، وهذا `Withdrawal` أصلًا.

### 3.2 كتالوج البنوك سجلّ TypeScript، لا جدولان في القاعدة

**رُفض:** `banks` + `bank_translations` على شاكلة `SystemCategory`/`SystemCategoryTranslation`.

ثلاثة عشر صفًّا لا تتغيّر تقريبًا أبدًا لا تستحقّ جدولًا وسكربت بذر رابعًا في `.github/workflows/ci.yml:85-90` وهجرة وذاكرة Redis ومسار إبطال لن يناديه شيء (`lookups.module.ts:87-104` يربط `invalidateCache` بطفرات اللغات فقط). `system_categories` استحقّ جدولًا عند ٥٥٩٥ عقدة.

والحجّة الحاسمة **اللغات**: المواصفة تريد ar/en/tr/ur، و`@CurrentLang()` يقصّ على `['en','ar']` ويخدم الإنجليزية بصمت لعميل تركي. تمرير tr/ur عبر `lookup.json` يعني مجلّدَي i18n جديدين وتوسيع مجموعة لغات المنصّة كلها — **قرار منصّة لا يجوز أن يركب على ميزة دفع**. الأسماء داخل السجلّ تجعل اللغات الأربع تعمل اليوم بلا لمس أي شيء آخر.

الثمن المقبول: تغيير اسم بنك يحتاج نشرة. وهذا صحيح — اسم بنك خاطئ خلل لا إعداد.

### 3.3 `bank_code` نصّ عادي مع `@IsIn(BANK_CODES)` — لا Prisma enum ولا FK

مجموعة مغلقة فيها عضو `other` **ليست مغلقة**. و`ALTER TYPE … ADD VALUE` لا يمكن تنفيذها في المعاملة التي تستخدم القيمة بعدها (لهذا `2026-08-16-integration-type-ai-media.sql` يترك الجملة وحدها)، فكل بنك مستقبلي هجرة من ملفّين. والمستودع يخزّن كل مفردات الطلب والدفع كنصّ عارٍ مع تعليق: `Order.payment_gateway String? // PaymentGateway enum value`، و`Refund.status`، و`Return.status`.

### 3.4 مفتاح التشغيل عمود حقيقي: `Shop.bank_transfer_enabled Boolean @default(false)`

**رُفض:** مفتاح داخل `Shop.settings` JSON.

كل راية سلوكية في هذا المخطّط عمود بكتلة `///`: `offers_merchant_delivery`، `offers_carrier_delivery`، `prices_include_tax`، `shipping_mode`. البوليان الوحيد داخل `settings` هو `isShopUnderMaintenance` وهو تقديمي. وثلاثة أعطال ملموسة لو ذهب إلى الـJSON:

- `mergeSettings` (`shops.service.ts:141-166`) **سطحيّ وعلى المستوى الأعلى**، فأيّ شاشة تحفظ أخيرًا تدهس المجموعة كاملة.
- `sanitizeSettings` (:108-122) يصبّ الكتلة **بلا أي تحقّق**، وتعليقه ينفي أيّ ضمان — غير مقبول لقيمة تحكم ظهور طريقة دفع.
- الدفع يدفع ثمن قراءة JSON غير مطبوعة على مسار ساخن.

**افتراضيًّا OFF، بعكس الدفع عند الاستلام**، وهذا هو بيت القصيد: متجر لم يسجّل حسابًا لا يستطيع استقبال تحويل، وطريقة دفع تظهر وحدها يوم النشر ترسل أموال المشترين إلى لا أحد.

### 3.5 الإتاحة = المفتاح **و** حساب نشط واحد على الأقل

نفس ازدواجية الشحن تمامًا: `ShippingProviderAccount.is_enabled` موجود **و**`Shop.offers_carrier_delivery` موجود، لأن الحساب هو **كيف** يصل المال والراية تقرّر **ماذا يُعرَض** على الزبون. تاجر يريد إيقاف التحويل شهرًا يجب ألّا يُضطرّ لحذف حسابات ما زالت تحويلات حيّة تشير إليها.

```ts
async isAvailable(shopId: string, tx = this.prisma): Promise<boolean> {
  const shop = await tx.shop.findFirst({
    where: { id: shopId, ...SOFT_DELETE_WHERE },
    select: {
      bank_transfer_enabled: true,
      _count: { select: { bank_accounts: { where: { is_active: true, deleted_at: null } } } },
    },
  });
  return Boolean(shop?.bank_transfer_enabled && shop._count.bank_accounts > 0);
}
```

### 3.6 نرفض `BANK_TRANSFER` للسلال متعدّدة المتاجر، و`OrderBankTransfer.shop_id` غير قابل للـnull

سلّة متعدّدة المتاجر تكتب أبًا بـ`shop_id: null` (`orders.service.ts:2935`) وN أبناء. تحويل على الأب **بلا مالك مراجعة** — الطابور مُنطاق بمتجر فوق طلب ليس كذلك. و«تحويل لكل ابن» يعني أن المشتري يرفع N إيصالات لحركة بنكية واحدة، وهذا أسوأ. `createFulfillmentTx` يرمي `ORDER_HAS_NO_SHOP` بدل التخمين، وهذا جواب البيت.

**الكلفة اليوم صفر:** الـstorefront مُنطاق بالمتجر عبر الـURL (`/[shopSlug]/checkout`)، فالسلّة العابرة للمتاجر غير قابلة للوصول منه أصلًا.

### 3.7 المبلغ يُنسَخ من الطلب دائمًا، والعملة من **لقطة الطلب** لا من `Shop.currency`

`amount_cents = order.total_cents`، أبدًا من جسم الطلبية — نفس القاعدة التي يتبعها `createPaymentLink` («اشحن المجموع النهائي الموثوق، لا مجموع المنتجات العاري»، `payment-intents.service.ts:189`). مشترٍ حوّل مبلغًا مختلفًا هو **رفض بسبب**، لا رقم مختلف في هذا العمود.

والعملة من `Order.currency` لأن الطلبات تحمل لقطة عملتها أصلًا (`schema.prisma:2506-2516)`، و`shop.context.ts:12-13` ينصّ على القاعدة. `Shop.currency` غير قابلة للتعديل عبر أي طفرة اليوم — وهذا بالضبط الشرط الذي تمرّ تحته القراءة الخاطئة دون أن يلاحظها أحد.

### 3.8 اللقطة تُفضَّل على الـjoin الحيّ في **كل** مسار قراءة

`bank_account_snapshot Json` مجمّدة وقت التقديم، تمامًا مثل `OrderProduct.variation_snapshot` و`Order.shipping_method`، وللسبب نفسه: قد يعدّل المتجر الحساب أو يحذفه في اليوم التالي لوصول المال، **وسجلّ أين ذهب المال يجب ألّا تعيد كتابته تلك التعديلات**.

الحذف الناعم يترك `bank_account_id` مشيرًا إلى صفّ حيّ، فـ`include: { bank_account: true }` يظلّ يعمل و**يبدو صحيحًا**. هذا أخطر ما في المسار: تكملة تلقائية واحدة تنقض الفكرة كلها بصمت.

### 3.9 التعارضان 409 حقيقيّان برمزين مخصّصين

كل حالة «تمّ التعامل معها سابقًا» في المستودع اليوم هي 422 `invalid_transition` (refunds، returns). لكن المستودع **يستعمل 409 حقيقية** بالمنشئ الطويل في `users.service.ts:124` و`whatsapp-instance.service.ts:148`. وهذان الحالتان تعارض حالة مورد — مطالبة ثانية على طلب واحد، مراجعة ثانية لصفّ واحد — لا مدخلات مشوّهة.

GraphQL يردّ 200 على كل حال، والعميل يقرأ `extensions.error_code` — فالرمز هو العقد، والرقم تجميلي. لهذا نضيف `AppException.conflict()` (المصنع غير موجود) ورمزين، ولا نعيد استعمال `invalid_transition` العامّ.

### 3.10 لا صلاحية جديدة

`MANAGE_OWN_SHOP` للحسابات والمفتاح، و`MANAGE_OWN_ORDERS`/`MANAGE_ALL_ORDERS` للطابور. صلاحية جديدة تكلّف `PermissionDriftService` و`check:drift` و`sync:permissions` على كل بيئة **وموجة إعادة تسجيل دخول** (الصلاحيات مخبوزة في الـJWT وقت التوقيع) — بلا مقابل.

> ⚠️ **`PermissionsGuard` يطابق بـ`.some()` لا `.every()`** (`permissions.guard.ts:45`)، و`ShopHeaderGuard` **لا يقارن `owner_id` أبدًا**. فالحارسان معًا لا يشكّلان حدًّا للملكيّة — انظر §12.

### 3.11 الواجهات المجمَّدة

كل سطر هنا محور اختُلف عليه أثناء التصميم، **وله جواب واحد**. اترك محورًا مفتوحًا و**من ينفّذ أوّلًا يضبط الوضع الأمني ضمنًا** — وهذا بالضبط ما يجعل ثغرة تُشحن بلا قرار.

| المحور | القرار |
|---|---|
| مسار الرفع | `POST /bank-transfers/orders/:orderId/receipt` — **ساق واحدة**، multipart، الملفّ وكل الحقول في نداء واحد |
| تخزين الإيصال | `PrivateReceiptStore` بسائقين: `db` (بايتات في جدول 1:1) و`s3-private`. الأعمدة كما في §4.2 حصرًا |
| متغيّر بيئة السائق | **`RECEIPT_STORAGE_DRIVER`** (لا `PRIVATE_STORAGE_DRIVER` ولا `RECEIPT_STORE`) |
| اختيار الحساب | على `CreateOrderInput.bank_account_id` (اختياريّ) **و** لقطة ثانية عند التقديم — §7.3 |
| قراءة الإتاحة | `shopPaymentOptions` (عامّ، **راية فقط**) + `shopBankAccounts` (**يتطلّب جلسة**، تفاصيل كاملة) |
| كتالوج البنوك | سجلّ TypeScript بأسماء اللغات الأربع **داخله**. لا جدول، لا `bank_translations`، لا مفاتيح `lookup.json`. اسم الاستعلام `banks(locale)` |
| `bank_code` | نصّ + `@IsIn(BANK_CODES)`. **لا `bank_id` FK** |
| قراءة تحويلات الطلب | استعلام جذريّ `orderBankTransfers(order_id)` — **لا حقل `bank_transfers` على `OrderEntry`** |
| قراءة رابط الإيصال | حقل `receipt_url` على الكيان، يُسَكّ في كل استجابة، يُقرَأ `fetchPolicy: 'no-cache'`. **لا استعلام `bankTransferReceipt(id)` منفصل** |
| مخطّط التوقيع | `v1.{transferId}.{urlKey}.{viewerId}.{expires}` بمفتاح فرعي مشتقّ. **لا وصل مباشر ولا `APP_SECRET` خامّ** |
| مدّة الرابط | `RECEIPT_LINK_TTL_SECONDS = 900` |
| رمز المطالبة المكرّرة | **`BANK_TRANSFER_ALREADY_PENDING`** |
| رمز رفض تعدّد المتاجر | **`BANK_TRANSFER_MULTI_SHOP_UNSUPPORTED`** |
| مصنع 409 | يُضاف `AppException.conflict(message, errorCode)` بدل بناء يدويّ مكرّر |
| `bank_account_snapshot` على حدّ GraphQL | **`ObjectType` مطبوع**، لا `GraphQLJSON` خامّ — الواجهتان كُتبتا على المطبوع |
| «هل هذا طلب تحويل بنكي؟» | **`payment_gateway` وحده**، في كل مكان. `altered_payment_gateway` عمود ثانٍ قابل للتعديل ولا يقرّر شيئًا هنا |
| ترتيب الأقفال | **`orders` ثم `order_bank_transfers`**، في التقديم والمراجعة معًا، ومكتوب مرّة في رأس الوحدة |
| اسم وثيقة ميزة التاجر | `apps/vendor/docs/features/bank-transfers.md` (جمع، مطابق للوحدة) |

---

## 4. نموذج البيانات

الموضع في `back-end/prisma/schema.prisma`: مباشرةً بعد `model PaymentMethod` (ينتهي ~:4574)، تحت بانر `// ─── Bank transfer (offline payment) ───`.

### 4.1 `ShopBankAccount`

| الحقل | النوع | ملاحظة |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `shop_id` | `String` | `onDelete: Cascade` |
| `bank_code` | `String` | مفتاح كتالوج، `@IsIn(BANK_CODES)` على الحدّ |
| `bank_name` | `String?` | مطلوب **فقط** حين `bank_code = 'other'`؛ CHECK في SQL اليدوية |
| `account_holder_name` | `String` | كما هو على الحساب، بخطّ التاجر |
| `account_number` | `String?` | واحد من الاثنين على الأقل — CHECK |
| `iban` | `String?` | مخزَّن **مُطبَّعًا**: أحرف كبيرة بلا مسافات، MOD-97 |
| `swift_code` | `String?` | يُملأ مسبقًا من الكتالوج ثم **قابل للتعديل** |
| `currency` | `String @default("SAR")` | |
| `notes` | `String?` | تُعرَض **للمشتري**، لا ملاحظات داخلية |
| `is_active` | `Boolean @default(true)` | مطفأ ≠ محذوف |
| `sort_order` | `Int @default(0)` | التعادل يُفضّ بـ`created_at` تصاعديًّا |
| `deleted_at` | `DateTime?` | حذف ناعم |

فهارس: `[shop_id]`، `[shop_id, is_active, deleted_at]`، `[deleted_at]`. و`@@map("shop_bank_accounts")`.

**التطبيع على الدخول لا على الخروج** — القيمة المخزَّنة هي ما تعرضه شاشة الدفع للمشتري لينسخه، وهي ما يقارنه الفهرس الفريد الجزئي؛ فـ`SA03 8000…` و`SA038000…` صفّان مختلفان بنظر Postgres.

### 4.2 `OrderBankTransfer`

| الحقل | النوع | ملاحظة |
|---|---|---|
| `order_id` | `String` | `Cascade` |
| `shop_id` | `String` | **غير قابل للـnull** (§3.6) و**`onDelete: Restrict`** — انظر التحذير أدناه |
| `customer_id` | `String?` | `SetNull` عمدًا: حذف حساب لا يمحو سجلّ أن مالًا طُولب به |
| `bank_account_id` | `String?` | `SetNull`. لتجميعات التاجر فقط — **لا تُقرأ للعرض** |
| `bank_account_snapshot` | `Json` | مجمّدة وقت التقديم — §3.8 |
| `amount_due_cents` | `Int` | من `order.total_cents`. **«المستحقّ» لا «المُدَّعى»** — انظر أدناه |
| `claimed_amount_cents` | `Int?` | ما يقول المشتري إنه حوّله فعلًا. **لا يُحتَجّ به**، وجوده الوحيد إظهار الفارق للمراجع |
| `currency` | `String @default("SAR")` | من لقطة الطلب |
| `sender_name` | `String` | نصّ حرّ — ما يطبعه بنك المشتري، وقد لا يطابق شيئًا |
| `sender_bank_code` | `String?` | **اختياري** في كل الطبقات (DTO وzod والعمود). من أين **غادر** المال، وغير مقيَّد بقائمة المتجر |
| `transfer_reference` | `String` | مرجع البنك. **ليس فريدًا** — البنوك تعيد استعمال مراجع قصيرة |
| `transferred_at` | `DateTime` | ليس مستقبلًا، وليس أقدم من ٦ أشهر |
| `note` | `String?` | |
| `receipt_mime_type` | `String` | مجموعة **أضيق** من `ALLOWED_MIMES` المشتركة — لا SVG ولا mp4 |
| `receipt_size` | `Int` | |
| `receipt_original_name` | `String` | لـ`Content-Disposition` فقط، **لا يُبنى منه مسار أبدًا** |
| `receipt_store` | `String` | `db \| s3-private`. يُكتب في **كل** إدراج — بخلاف `Attachment.disk` الذي يعلن `@default("local")` ولا يكتبه شيء، فهو كذب على كل صفّ قائم |
| `receipt_path` | `String?` | مفتاح الكائن حين `receipt_store = 's3-private'`. **لا يظهر في أي استجابة** |
| `receipt_url_key` | `String` | ١٦ بايت عشوائيّة — **مقبض السحب**: تدويره يقتل كل رابط معلّق فورًا |
| `receipt_checksum_sha256` | `String?` | إشارة السلامة الوحيدة على مستند مال |
| `receipt_purged_at` | `DateTime?` | تضعه وظيفة الاحتفاظ؛ الصفّ يبقى والواجهة تقول «أُتلف» بدل رابط مكسور |
| `status` | `String @default("pending")` | `pending \| approved \| rejected` |
| `reviewed_by_id` / `reviewed_at` | `String?` / `DateTime?` | `SetNull` |
| `rejection_reason` | `String?` | ٣–٥٠٠ حرف، مطلوب عند الرفض، **يراه المشتري** |

فهارس: `[order_id]`، `[shop_id, status]`، `[customer_id]`، `[bank_account_id]`، `[status]`، `[created_at]`.

> ⚠️ **`onDelete: Restrict` لا `Cascade` على `shop_id`.** `Order.shop_id` هو `SetNull`، فحذف متجر حذفًا صلبًا مع Cascade **يتلف كل سجلّ مال لذلك المتجر بينما تنجو الطلبات نفسها** — أسوأ نتيجة ممكنة. `Shop.owner` نفسه `Restrict` للسبب عينه.
>
> ⚠️ **لا `deleted_at` على هذا الجدول.** سجلّ مال تحرّك **غير قابل للحذف الناعم**، ووجود العمود يفتح ثقبًا كامنًا: هو في مسند الحظر **وفي شرط `WHERE` للفهرس الفريد الجزئي**، فأوّل حذف ناعم يُضاف لاحقًا (أداة دعم، مسح GDPR، تنظيف أدمن) **يحرّر خانة المطالبة الوحيدة بصمت** ويسمح بتحويل معتمَد ثانٍ على طلب مدفوع أصلًا. حذفه يزيل المسند من ثلاثة مواضع.
>
> ⚠️ **`amount_cents` كان اسمًا مضلّلًا.** القيمة تُنسخ من `order.total_cents`، و`total_cents` **لا يُكتب بعد إنشاء الطلب أبدًا** (`updateOrder` يقبل `order_status` و`payment_status` والعنوانين و`delivery_time` و`altered_payment_gateway` و`note` فقط). فمقارنة `amount_cents !== order.total_cents` **غير قابلة للتحقّق بنيويًّا**، وأي تحذير «المبلغ لا يطابق» مبنيّ عليها **لن يشتعل أبدًا** — ويقرؤه المراجع كطمأنة كاذبة. فإمّا `amount_due_cents` صريحًا، و`claimed_amount_cents` هو ما يعطي المراجع فارقًا حقيقيًّا ينظر إليه.

### 4.3 العلاقات المضافة على النماذج القائمة

```prisma
// model Shop  — كتلة العلاقات (:549-628؛ النموذج ينتهي عند :629)
bank_accounts  ShopBankAccount[]
bank_transfers OrderBankTransfer[]

// model Shop — العمود، بجوار offers_carrier_delivery (:496)
bank_transfer_enabled Boolean @default(false)

// model Order (:2543-2553)
bank_transfers OrderBankTransfer[]

// model User — علاقتان مُسمّاتان إلزاميًّا: النموذج يشير إلى User مرّتين،
// وبدون التسمية يفشل `prisma generate`.
bank_transfers_submitted OrderBankTransfer[] @relation("bank_transfer_submitter")
bank_transfers_reviewed  OrderBankTransfer[] @relation("bank_transfer_reviewer")
```

### 4.4 الهجرة — الثلاثة أشياء التي لا يستطيع `db push` إنتاجها

المستودع **بلا `prisma migrate`**: كل شيء `db push` + SQL يدويّة في `prisma/migrations/manual/`. الملفّ `2026-09-08-bank-transfer.sql` على بنية `2026-08-24-cod-allocations.sql` (رأس نثري، `CREATE TABLE IF NOT EXISTS`، كل FK داخل `DO $$ … pg_constraint conname … END $$`). والثلاثة التي تبرّر وجوده أصلًا:

```sql
-- مطالبة قائمة واحدة لكل طلب. Prisma لا تعبّر عن فهرس فريد جزئي.
-- قفل SELECT … FOR UPDATE في الخدمة هو النصف الأوّل، وهذا هو النصف
-- الذي ينجو من خلل في الخدمة.
CREATE UNIQUE INDEX IF NOT EXISTS "order_bank_transfers_one_outstanding"
  ON "order_bank_transfers" ("order_id")
  WHERE "status" IN ('pending','approved') AND "deleted_at" IS NULL;

-- طريقة واحدة على الأقل لاستقبال المال.
ALTER TABLE "shop_bank_accounts"
  ADD CONSTRAINT "shop_bank_accounts_identifier_present"
  CHECK ("account_number" IS NOT NULL OR "iban" IS NOT NULL);

-- bank_name مطلوب حصرًا حين bank_code = 'other'.
ALTER TABLE "shop_bank_accounts"
  ADD CONSTRAINT "shop_bank_accounts_other_needs_name"
  CHECK ("bank_code" <> 'other' OR "bank_name" IS NOT NULL);
```

> 🔴 **المصيدة:** الفهرس الجزئي **غير مرئي** لا لـ`prisma db push` ولا لـ`npm run check:drift` (يقارن أعمدة لا فهارس). بيئة جديدة تُنشَأ بالـpush وحدها **تفقد الضمانة بصمت**. لهذا:
> 1. يُضاف الملفّ إلى قائمة الخطوات اليدوية الإلزامية في `back-end/docs/10_deployment/README.md:50-56`.
> 2. تُضاف خطوة إلى `.github/workflows/ci.yml` بعد «Apply schema to a scratch database» تنفّذ `npx prisma db execute --file …`، وإلّا فـCI عنده الجداول بلا الفهرس ولا الـCHECK، والضمانة الوحيدة التي تهمّ **غير مختبَرة في المكان الوحيد الذي يكشفها**.

**الترتيب في الإنتاج:** SQL أوّلًا ثم النشر. `SchemaDriftService` يعتبر جدولًا مفقودًا انحرافًا قاتلًا ويُجهض الإقلاع **قبل فتح أي منفذ**، فيبلّغ Render عن «No open ports detected» بلا ذكر الجدول.

**لا backfill ولا إمكانيّة له:** لم يسجّل متجر حسابًا قط ولم يطالب مشترٍ بتحويل قط. اختراع صفوف لطلبات ماضية يخلق مطالبات لم يقدّمها أحد.

---

## 5. كتالوج البنوك

`back-end/src/bank-transfers/banks.registry.ts` — سجلّ TS نقيّ بلا قاعدة بيانات، على شاكلة `listEnhanceStyles(lang)`.

| # | `code` | `swift` | en | ar |
|---|---|---|---|---|
| 1 | `al_rajhi` | `RJHISARI` | Al Rajhi Bank | مصرف الراجحي |
| 2 | `snb` | `NCBKSAJE` | Saudi National Bank | البنك الأهلي السعودي |
| 3 | `riyad` | `RIBLSARI` | Riyad Bank | بنك الرياض |
| 4 | `sab` | `SABBSARI` | Saudi Awwal Bank | البنك السعودي الأول |
| 5 | `alinma` | `INMASARI` | Alinma Bank | مصرف الإنماء |
| 6 | `bsf` | `BSFRSARI` | Banque Saudi Fransi | البنك السعودي الفرنسي |
| 7 | `anb` | `ARNBSARI` | Arab National Bank | البنك العربي الوطني |
| 8 | `albilad` | `ALBISARI` | Bank Albilad | بنك البلاد |
| 9 | `aljazira` | `BJAZSAJE` | Bank AlJazira | بنك الجزيرة |
| 10 | `gib` | `GULFSARI` ⚠ | Gulf International Bank | بنك الخليج الدولي |
| 11 | `saib` | `SIBCSARI` | The Saudi Investment Bank | البنك السعودي للاستثمار |
| 12 | `stc_pay` | `STCBSARI` ⚠ | stc pay | اس تي سي باي |
| 13 | `other` | `null` | Other bank | بنك آخر |

الصفّ يحمل كذلك `tr` و`ur` (المواصفة تطلبهما) و`icon` و`sort_order`. ⚠ = **يجب التحقّق من الـBIC قبل الدمج**؛ البقيّة تتبع الصيغة السعودية المنشورة (`BBBB` + `SA` + المدينة). ولأن `swift` يملأ حقلًا **قابلًا للتعديل**، فالقيمة الخاطئة افتراض يصحّحه التاجر لا حساب مسدود.

**`bankCatalogue(locale)`** دالة نقيّة متزامنة تسقط إلى الإنجليزية **لكل بنك على حدة** لا للحمولة كلها، فلغة بجدول ناقص تتدهور صفًّا صفًّا.

**الشعارات:** `apps/storefront/public/banks/<code>.svg` و`apps/vendor/public/banks/<code>.svg` (١٢ ملفًّا، لا ملفّ لـ`other`). السجلّ يعيد **مسارًا نسبيًّا** (`/banks/al_rajhi.svg`) لا رابطًا مطلقًا: الـback-end بلا `public/` وبلا `APP_URL`، وثلاثة تطبيقات تخدم من ثلاثة أصول. والرفع مستحيل أصلًا — `attachments.service.ts:523` يرفض SVG البعيدة كناقل XSS. العرض بـ`<img>` عاديّة مع `onError` يخفيها، على شاكلة شعارات الناقلين في `checkout-page.tsx:781-789`.

**`lib/iban.ts`** — لا يوجد أي تعامل مع IBAN في المستودع، فهذا كود جديد بالكامل: `normalizeIban()` (أحرف كبيرة، حذف المسافات) و`isValidIban()` (ISO 13616، MOD-97، محسوبة على أجزاء فلا يتجاوز أي وسيط `MAX_SAFE_INTEGER`). **دوال نقيّة تناديها الخدمة، لا مزخرِف class-validator مخصّص** — لأن `grep -rn "registerDecorator|ValidatorConstraint"` يعيد صفرًا في المستودع كلّه، ولأن المزخرِف **لا يستطيع التطبيع**، فينتهي بتطبيقين لقاعدة واحدة.

---

## 6. سطح الـAPI

### 6.1 جدول التحويل: REST المصدر ← عمليّاتنا

| المواصفة الأصلية | عندنا | الحرّاس | الصلاحية | X-SHOP |
|---|---|---|---|---|
| `GET /banks` | `banks(locale)` — Query | **لا حرّاس إطلاقًا** | — | لا |
| — (جديدة) | `shopPaymentOptions` — Query | `OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard` | — | نعم |
| `GET /shops/bank-accounts` (المشتري) | `shopBankAccounts` — Query | **`JwtAuthGuard`**, `ShopHeaderGuard, RequireShopGuard` | — | نعم |
| `POST /shops/bank-accounts` | `createShopBankAccount` | السلسلة الكاملة + `ShopOwnershipGuard` | `MANAGE_OWN_SHOP` | نعم |
| `PUT /shops/bank-accounts/:id` | `updateShopBankAccount` | نفسها + **تحقّق من الصفّ** | `MANAGE_OWN_SHOP` | من الصفّ |
| `DELETE /shops/bank-accounts/:id` | `deleteShopBankAccount` | نفسها + **تحقّق من الصفّ** | `MANAGE_OWN_SHOP` | من الصفّ |
| `PUT /shops/payment-methods/bank-transfer` | `updateBankTransferSettings` | السلسلة الكاملة | `MANAGE_OWN_SHOP` | نعم |
| `POST /checkouts/:token/complete` | `createOrder` (قائمة) + `shopPaymentOptions` (جديدة) | كما هي | — | نعم |
| `POST /orders/:order/bank-transfer` | **`POST /bank-transfers/orders/:orderId/receipt`** (REST) | `JwtAuthGuard, ShopHeaderGuard` + throttle | — | من الطلب |
| `GET /orders/:order/bank-transfers` | `orderBankTransfers(order_id)` — Query | `JwtAuthGuard` | — | من الصفّ |
| `GET /bank-transfers` | `bankTransfers(status, page, limit)` — Query | `JwtAuthGuard, PermissionsGuard, ShopHeaderGuard` | `MANAGE_OWN_ORDERS` | نعم |
| `GET /bank-transfers/:id` | `bankTransfer(id)` — Query | `JwtAuthGuard` + تحقّق من الصفّ | — | من الصفّ |
| `POST /bank-transfers/:id/approve` | `reviewBankTransfer(status: APPROVED)` | `JwtAuthGuard, PermissionsGuard` + تحقّق من الصفّ | `MANAGE_OWN_ORDERS` | من الصفّ |
| `POST /bank-transfers/:id/reject` | `reviewBankTransfer(status: REJECTED, reason)` | نفسها | `MANAGE_OWN_ORDERS` | من الصفّ |
| — | **`GET /bank-transfers/receipts/:id`** (REST، موقّع) | **بلا حارس** — §8.3 | — | لا |

**`approve` و`reject` طفرة واحدة** `reviewBankTransfer` لا اثنتان: نفس القفل، نفس حارس المراجعة المزدوجة، نفس الحدث — عمليتان تعنيان نسختين من ذلك كلّه.

> 🔴 **الاستعلامان منفصلان عن قصد، وهذا أخطر ما في الجدول.** `shopPaymentOptions` عامّ لكنّه يعيد **الإتاحة فقط** (`bank_transfer_available` + قائمة البوّابات المعروضة) — **صفر بيانات حساب**. أمّا `shopBankAccounts` الذي يحمل `iban` و`account_number` كاملين فيحتاج **جلسة**.
>
> السبب: `OptionalJwtGuard` **يعيد true بلا توكن إطلاقًا** (`optional-jwt.guard.ts:28-29`)، واستعلام دليل المتاجر `shops` هو `OptionalJwtGuard` بدوره — فكل slug **قابل للعدّ**. سكربت واحد يمشي على الدليل ويحصد **اسم صاحب الحساب وIBAN لكل تاجر على المنصّة**: عُدّة تصيّد جاهزة موجَّهة إلى زبائن ذلك المتجر بالذات.
>
> والمستودع ينصّ على القاعدة نفسها أصلًا في `shops.service.ts:247-262`: «الماليّات لمالك أو أدمن فقط. المنادي العامّ يحصل على `balance: undefined` … ولا يحصل أبدًا على الحساب البنكي داخل `payment_info`».
>
> **والكلفة صفر:** `createOrder` هو `JwtAuthGuard` أصلًا، فالدفع كضيف مرفوض من الخادم عمدًا. المشتري **لا بدّ** أن يسجّل دخوله ليطلب أصلًا، فطلب الجلسة لرؤية الـIBAN لا يمنع أحدًا من شيء. التبويب يُرسَم من راية الإتاحة، ولوحة التفاصيل تُحمَّل بعد تسجيل الدخول.

### 6.2 لماذا الرفع REST وليس GraphQL

`graphql-upload` غير مثبّت، وإضافته إلى Apollo 5 تعني معركة مع ترتيب body-parser لأجل نقطة واحدة، وتضيف حزمة ذات تاريخ CVE إلى نقطة GraphQL الوحيدة.

**ولماذا لا نعيد استعمال `POST /attachments`؟** خمسة تناقضات مباشرة مع المواصفة، كلّها متحقَّق منها:
1. البايتات تهبط في شجرة يخدمها `main.ts:207-214` علنًا بـ`ACAO: *` وبلا حارس.
2. `AttachmentsService.delete()` **يحذف البايتات حذفًا صلبًا** قبل أن يضع `deleted_at`.
3. `findByShop` بلا استثناء للسياق — فالإيصال يظهر في مكتبة ملفّات التاجر، **قابلًا لإعادة التسمية واستبدال البايتات** عبر `POST /attachments/:id/replace`.
4. `assertStorageLimit` يحمّل رفع **المشتري** على سقف خطّة **التاجر**.
5. `rewriteAttachmentUrls` يعيد كتابة الرابط المخزَّن عند الاستبدال — وهو تحديدًا ما تمنعه قاعدة اللقطة.

**نداء واحد لا نداءان:** فحص المطالبة القائمة، ونسخ المبلغ من الطلب، وكتابة اللقطة يجب أن تُثبَت معًا. مسار من خطوتين يترك بايتات يتيمة على القرص الخاص كلّما ردّت الخطوة الثانية 409، ويحتاج قصّة تفويض ثانية لصفّ إيصال معلّق.

### 6.3 الملاحظة التي يجب أن يفهمها المنفّذ قبل كتابة الـcontroller

`@CurrentUser()` و`@CurrentShop()` و`JwtAuthGuard` **تعمل على مسار REST بمصادفة موثّقة، لا بتصميم**. جميعها تنادي `GqlExecutionContext.create(ctx).getContext().req`. في معالج HTTP تكون الوسائط `[req, res, next]` بطول 3، و`normalizeResolverArgs` يعتبر الطول 3 قائمة وسائط reference-resolver فيدسّ `undefined` في الفهرس 1 — فيصبح `getArgByIndex(2)` هو **`res`**، وExpress يضبط `res.req` عائدًا إلى الطلب.

هذا سبب عمل `POST /attachments` في الإنتاج منذ سنة. وهو **حامل للحمل وغير موثّق**: يكسر مع Fastify، ويكسر مع أي تغيير في تلك الاستدلالية، ويكسر **كل مسارات REST دفعة واحدة**. `ShopHeaderGuard` وحده آمن لأنه يستعمل `requestOf()` المحايد للناقل. القرار: نوثّق المصادفة في رأس الـcontroller ولا نخترع مسار مصادقة موازيًا — وتُفتح تذكرة منفصلة لنقل الثلاثة إلى `requestOf()`.

### 6.4 رموز الأخطاء

| الرمز | HTTP | متى |
|---|---|---|
| `BANK_TRANSFER_NOT_AVAILABLE` | 422 | `createOrder` بـ`BANK_TRANSFER` والمفتاح مطفأ أو لا حساب نشط |
| `BANK_TRANSFER_MULTI_SHOP_UNSUPPORTED` | 422 | سلّة تتجاوز متجرًا واحدًا |
| `BANK_ACCOUNT_UNAVAILABLE` | 422 | الحساب لمتجر آخر، أو عُطّل/حُذف بعد اختياره |
| `BANK_TRANSFER_ALREADY_PENDING` | **409** | تقديم بينما توجد مطالبة `pending` أو `approved` |
| `BANK_TRANSFER_ALREADY_REVIEWED` | **409** | مراجعة صفّ حالته ليست `pending` |
| `OFFLINE_GATEWAY` | 422 | `createPaymentLink` على طلب بوّابته غير متّصلة |

الرفوض على مستوى الحقل تبقى `AppException.validation([{ field, code, messages }])` بـ**SCREAMING_SNAKE**: `INVALID_IBAN`، `ACCOUNT_REQUIRED`، `BANK_NAME_REQUIRED`، `TRANSFER_DATE_IN_FUTURE`، `TRANSFER_DATE_TOO_OLD`، `INVALID_FILE_TYPE`، `FILE_TOO_LARGE`، `REASON_REQUIRED`.

> كل رمز جديد يحتاج سطرًا في `i18n/{en,ar}/common.json` — `formatError` يستبدل رسالة GraphQL بـ`t(code, lang)`، فالمفتاح المفقود يصل العميل **كنصّ الرمز الخام**.

---

## 7. تدفّقات الخدمة

### 7.1 `determineInitialStatuses` — التعديل كلّه سطران

```ts
// back-end/src/orders/orders.service.ts:948-973 — قبل default: مباشرةً
case PaymentGateway.BANK_TRANSFER:
  return { orderStatus: OrderStatus.PENDING, paymentStatus: PaymentStatus.AWAITING_APPROVAL };
```

بدونه يبتلع `default:` القيمة ويعيد `{PENDING, PENDING}` — **طلب على شكل بطاقة لا يراجعه أحد**، و`voidOrderForFailedPayment` سيبطله بسرور. ولا يوجد فحص شمولية على الـswitch، فالإغفال صامت.

### 7.2 حارس الإتاحة داخل معاملة `createOrder`

`CreateOrderInput.payment_gateway` هو `@IsOptional() @IsString()` **فقط** (`create-order.input.ts:44-47`) — أي نصّ يُقبَل حرفيًّا. فبدون فحص من طرف الخادم يرسل المشتري ببساطة `payment_gateway: "BANK_TRANSFER"` إلى متجر عطّلها، ويحصل على طلب في حالة لا يراجعها أحد.

الموضع: `orders.service.ts:2242-2243`، **داخل** المعاملة الـSerializable، بعد اشتقاق `gateway` وقبل `determineInitialStatuses`. منتقي الـstorefront **تسهيل، لا حدّ أمنيّ**.

### 7.3 كيف يسافر الحساب المختار — وأين يُجمَّد

المواصفة تخزّنه على صفّ checkout غير موجود عندنا. القرار: **لقطتان لا واحدة**، وكلٌّ تجيب سؤالًا مختلفًا.

| اللقطة | متى | تجيب |
|---|---|---|
| `Order.payment_instructions Json?` (عمود جديد، اختياري) | عند `createOrder` | **بماذا أُخبِر المشتري** — يراها على شاشة التأكيد فورًا، قبل وجود أي تحويل |
| `OrderBankTransfer.bank_account_snapshot Json` | عند التقديم | **أين ذهب المال فعلًا** |

والاثنتان **قد تختلفان عن قصد**: ربما أضاف التاجر حسابًا أفضل بعد الطلب ودفع المشتري إليه. «قيل له X ويدّعي أنه دفع Y» إشارة حقيقية على شاشة المراجعة — إمّا تغيير من التاجر وإمّا راية احتيال — وتوحيدهما يقتل الإشارة.

`Order.shipping_method Json?` هي الحالة نفسها المحلولة أصلًا، بتعليق يشرح السبب حرفيًّا: مجمّدة عند الإنشاء «كي يبقى الطلب قادرًا على قول Standard Shipping بعد أن يعدّل التاجر مناطقه أو يحذفها».

> عمود إضافي على `orders` — أكثر جدول قراءةً في المخطّط — كلفة حقيقية. البديل (إعادة قراءة حسابات المتجر وقت العرض) يترك المشتري بلا تعليمات قابلة للاسترجاع إن حُذف الحساب. **هذا سؤال مفتوح — §19.**

### 7.4 الخطر المعكوس في `createPaymentLink`

`payment-intents.resolver.ts:47` يعلن `@Args('payment_gateway', { defaultValue: 'STRIPE' })`. فأي عميل ينادي `createPaymentLink(orderId)` بلا بوّابة على طلب تحويل بنكي **يمرّ من حالة STRIPE**، ويفتح جلسة Stripe حيّة، ويكتب صفّ `PaymentIntent`، و**يعيد كتابة `order.payment_gateway` إلى STRIPE** في :239-244 — محوّلًا طلبًا غير متّصل إلى طلب بطاقة بصمت.

`case 'BANK_TRANSFER': throw` داخل الـswitch **لا يمسك هذا**، لأن الوسيط يقول STRIPE. الفحص يجب أن يكون على بوّابة **الطلب** لا على الوسيط، ويجب أن يقع **بعد** حارس `ALREADY_PAID` (:152-160) و**قبل** الـswitch.

### 7.5 `submit` — الترتيب داخل الخدمة

يُنسَخ من `AttachmentsService.replace()` **لا** من `upload()`. الفرق ليس أسلوبيًّا: `upload()` ينادي `storage.put` ثم `ThumbnailService.generate` الذي **بلا try/catch** ويرمي على صورة تالفة — فيترك كائنًا يتيمًا وبلا صفّ، بصمت. `replace()` يرفع أوّلًا، ثم يفتح المعاملة، وعند أي رمي ينادي `discard()` الذي **لا يرمي أبدًا** ثم يعيد الرمي.

1. تحقّق من الملف (النوع **المستنشَق** من البايتات لا المعلن، ثم الحجم) ومن الحقول؛ احضر الطلب تحت مرشّح المشتري.
2. `privateStore.put(...)` — **البايتات أوّلًا، خارج المعاملة**. التخزين ليس معامليًّا، وأحدهما يجب أن يسبق. و I/O داخل معاملة `createOrder` الـSerializable ممنوع أصلًا للسبب نفسه.
3. `withSerializableRetry(() => prisma.$transaction(async tx => { … }))`:
   - `SELECT "id" FROM "orders" WHERE "id" = $1 FOR UPDATE`
   - إعادة قراءة `ShopBankAccount` (نشط، غير محذوف، نفس المتجر) → وإلّا `BANK_ACCOUNT_UNAVAILABLE`
   - عدّ المطالبات `pending|approved` → وإلّا **409** `BANK_TRANSFER_ALREADY_PENDING`
   - `amount_cents = order.total_cents`، `currency = order.currency`، `bank_account_snapshot = serializeJson({...})`
   - إعادة `order.payment_status` إلى `payment-awaiting-for-approval` (عديمة الأثر عند التقديم الأوّل، ومهمّة بعد رفض)
4. عند الرمي: `privateStore.delete(path)` في catch لا يرمي، ثم إعادة الرمي.
5. بعد الإثبات: `void auditLog.log(...)` ثم `emit('bank_transfer.submitted')` داخل try/catch.

> **يُمسَك `P2002` أيضًا ويُحوَّل إلى الـ409 نفسها** — الفهرس الجزئي هو خطّ الدفاع الثاني وقد يسبق العدّاد في سباق.

### 7.6 `approve` / `reject`

`review` **لا يمرّ عبر `OrdersService.updateOrder`**. لماذا: `updateOrder` لا يأخذ سببًا، ولا يضع قفلًا، وينفّذ `prisma.order.update` في :3607 **خارج أي معاملة** (فالصفّ مكتوب فعلًا حين ترمي خطوة لاحقة)، ثم يشغّل خطّاف الوفاء ونداءات العمولة والرصيد وفكّ الإلغاء — ولا شيء من ذلك يخصّ اعتماد دفعة. الشكل المعتمد للانقلاب الناتج عن دفع هو `prisma.order.update` مباشرة تحت قفل، وهو ما يفعله `stripe-webhook.controller.ts:258-264` و`payment-intents.service.ts:321-327` كلاهما.

> 🔴 **قبل أي كتابة: المراجعة ترفض طلبًا لم يعد قابلًا للدفع.** داخل المعاملة وبعد إعادة قراءة الطلب تحت القفل، إن كانت `order_status` واحدة من `order-cancelled | order-refunded | order-failed` نرفض بـ`BANK_TRANSFER_ORDER_NOT_PAYABLE` (422).
>
> **بدون هذا الفحص يوجد خلل مال حقيقي، والمشتري يملك طرفَي النافذة:** `cancelOrder` يقبل الزبون المالك (`orders.service.ts:3908`)، و`order-pending → order-cancelled` انتقال مشروع، و`applyCancellationEffects` يعيد المخزون ويفكّ استعمال الكوبون ويردّ رصيد المحفظة. ثم يعتمد التاجر التحويل بعد دقائق فتُكتب `payment-success` **بلا شرط** — لأن المحروس هو `order_status` وحده.
>
> والنتيجة **لا تُقرأ ملغاة بل مدفوعة**: `deriveFinancialStatus` يحرس فرع VOIDED بـ`!paid` (`orders.service.ts:1284-1287`)، فيسبقه فرع PAID. ثم يُطلَق `ORDER_PAID` على طلب ملغى، **ولا شيء يستطيع التراجع**: `voidOrderForFailedPayment` يعود مبكّرًا على أي حالة مدفوعة (:4032-4036).
>
> مسار التقديم يفحص الطلبات الملغاة؛ **مسار المراجعة — حيث تعيش الفجوة الزمنيّة كلّها — لا يفحص.**

**عند الاعتماد:**
- `payment_status → payment-success` بلا شرط
- `order_status → order-processing` **فقط إن كان ما يزال `order-pending`**. طلب دُفع إلى `order-out-for-delivery` لا يُسحَب إلى الوراء. ولاحظ: `VALID_ORDER_TRANSITIONS` **لن ترفض** كتابتنا لأن الجدول يُستشار داخل `updateOrder` و`cancelOrder` فقط — فالشرط هو الحماية الوحيدة.
- `order.status.changed` يُطلَق **فقط إن تغيّر `order_status` فعلًا**
- `fireOrderWebhook(ORDER_PAID)` — وهذا يتطلّب تحويل التابع من `private` إلى `public` على `OrdersService`. بدونه لا يعرف أي مشترك webhook أن الطلب دُفع، وإعادة بناء الحمولة محليًّا تشحن `ORDER_PAID` بشكل يخالف كل `ORDER_PAID` أخرى.

**عند الرفض:**
- `payment_status → payment-failed`؛ `order_status` **لا يُمَسّ**، فيبقى `order-pending` كي يهبط تحويل مصحَّح
- ما يفتح إعادة التقديم هو **شكل قاعدة الوحدانية نفسها**: تعدّ `pending|approved` فقط، فالصفّ المرفوض غير مرئي لها ويبقى تاريخًا

**لا استئناف عديم الأثر (idempotent no-op) عند المراجعة الثانية** — بخلاف `RefundsService.updateRefundStatus`. الاسترجاع يستطيع لأنّ اعتماده مرّتين هو نفس حركة المال؛ هنا ليس كذلك: اعتماد ثانٍ يعيد إطلاق إشعار المشتري، ويعيد إطلاق `ORDER_PAID`، وقد يقلب حالة طلب دفعها التاجر عمدًا للأمام.

### 7.7 ما يجب ألّا يحدث عند الاعتماد

**لا** إضافة رصيد للبائع، **لا** عمولة، **لا** صفّ دفتر، **لا** حركة محفظة، **لا** كوبون، **لا** مخزون، **ولا** `PaymentIntent`.

`updateVendorBalance(orderId, 'add')` يعمل عند `order_status → order-completed` فقط (`orders.service.ts:3626-3632`) ولا يعمل عند نجاح الدفع — لا webhook سترايب ولا `confirmPayment` يلمسان الرصيد. إضافة قيد هنا **تُقيّد مرّتين** عند إتمام الطلب لاحقًا. والمخزون والمحفظة والكوبون استُهلكت كلّها عند `createOrder` وهي محايدة تجاه البوّابة.

**و`cod-allocation` لا يحتاج استثناءً ويجب ألّا يُعطى واحدًا:** المدخلان يعودان مبكّرًا على اختبار **موجب** (`payment_gateway !== CASH_ON_DELIVERY`)، فالبوّابة الجديدة مستثناة تلقائيًّا. حارس زائد يوحي بأن الملفّ يستعمل قائمة حظر، فيدعو البوّابة التالية للإضافة إليها.

---

## 8. تخزين الإيصالات — أخطر جزء في الخطة

### 8.1 لماذا لا شيء قائم يصلح

| الخيار | لماذا يفشل |
|---|---|
| `POST /attachments` | كل شيء يكتبه عامّ (§6.2) |
| توسيع `StorageDriver` بـ`signedUrl()` | الواجهة `put` + `delete` فقط؛ و`StorageFactory.create()` **يحفظ سائقًا واحدًا للعمليّة**، فطلب وجهة ثانية يعيد العامّة بصمت؛ ويجبر ثلاثة سائقين على نموّ تابع لا يستطيع اثنان منهم الوفاء به |
| التوقيع عند المزوّد | `@aws-sdk/s3-request-presigner` **غير مثبّت**، وBunny بلا presigning إلّا بتفعيل Token Authentication وكتابة المخطّط يدويًّا. والأهمّ: **رابط موقّع من CDN لا يمكن سحبه** ولا إعادة فحص ملكيّته |
| `DigitalFilesService` كسابقة | **فخّ.** الـcontroller الذي يشير إليه (`/api/downloads/:token`) **غير موجود**، ويحسب الانتهاء من `created_at` بـ24 ساعة مثبّتة بلا `expires_at`، و`verifyDownloadToken` يعيد في النهاية **الرابط العامّ العادي للملفّ** — فالتوكن لا يحرس شيئًا |

**السابقة الصالحة الوحيدة** هي `MagicLinkService.generateSignature` (`magic-link.service.ts:31-36`, `:137-159`): HMAC-SHA256، وفحص الانتهاء **قبل** `timingSafeEqual`، وفحص طول قبله لأن `timingSafeEqual` **ترمي** على طولين مختلفين بدل أن تعيد false.

### 8.2 `PrivateReceiptStore` — بذرة بسائقين

واجهة داخل الوحدة، منفصلة تمامًا عن `StorageDriver`:

```ts
interface PrivateReceiptStore {
  put(key: string, buffer: Buffer, mime: string): Promise<void>;  // لا يعيد رابطًا — عمدًا
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
```

`put` **لا يعيد شيئًا** عن قصد: أن يعيد رابطًا هو ما يجعل كل شيء آخر في هذا المستودع عامًّا.

**سائقان، والقرار بينهما هو أهمّ سؤال تشغيليّ في الميزة:**

| السائق | متى | الميزة | الحدّ |
|---|---|---|---|
| `db` — Postgres `bytea` في جدول `bank_transfer_receipts` منفصل 1:1 | التطوير، وأوّل شحنة | **بنية تحتية صفر**، وخاصّ بالبناء (لا رابط عامّ لـPostgres)، و**البايتات تُكتب داخل المعاملة نفسها** فيختفي صنف الملفّات اليتيمة كلّه | حجم قاعدة Neon |
| `s3-private` | الإنتاج | يقيس | يحتاج bucket **غير** الذي خلف `S3_CDN_URL`، بسياسة IAM خاصّة به — **قرار تزويد يسبق النشر** |

الجدول **منفصل لا عمود** لسبب ميكانيكيّ: `Bytes` تصل إلى 5MB وPrisma بلا تحميل كسول على مستوى العمود، فـ`orderBankTransfer.findMany()` على طابور مراجعة كان سيبثّ عشرات الميغابايت ليجيب سؤالًا عن الحالات.

> 🔴 **`local-private` على Render يفقد الإيصالات بصمت.** `render.yaml` بلا كتلة `disk:` وعلى `plan: free`، فنظام ملفّات الحاوية زائل: الصفوف تنجو وبايتاتها تختفي مع كل نشرة، بلا خطأ في أي مكان. المصنع **يرفض** `local-private` تحت `NODE_ENV=production` إلّا بـ`ALLOW_LOCAL_PRIVATE_RECEIPTS=1`.
>
> 🔴 **توجيه السائق الخاصّ إلى منطقة Bunny القائمة يجعل كل إيصال عامًّا ولا يخطئ شيء.** الـpull zone يخدم منطقة التخزين **بأكملها**، فبادئة `bank-transfer-receipts/` داخلها قابلة للجلب. و`onModuleInit` يرمي عند الإقلاع إن كان `resolve(PRIVATE_UPLOAD_DIR)` داخل `resolve(UPLOAD_DIR)` — **هذا الفحص هو الأمان الحامل للحمل كلّه**، ومن يخفّفه لاحقًا إلى تحذير يعيد العطل إلى الصمت.

### 8.3 الرابط الموقّع

**يُسَكّ في كل استجابة، ولا يُخزَّن في عمود أبدًا.** السبب منصوص عليه في `storage.factory.ts:46-60`: الرابط مخبوز وقت الكتابة و«لا حلّ وقت القراءة يصحّحه لاحقًا — فالقاعدة السيّئة ليست عطلًا في العرض بل صفًّا كُتب خطأً ويبقى خطأً». رابط موقّع مخزَّن **ينتهي في مكانه** ويصبح رابطًا ميّتًا داخل القاعدة.

الرسالة الموقَّعة `v1.{transferId}.{urlKey}.{viewerId}.{expires}` بمفتاح فرعي مشتقّ من `APP_SECRET` (لا `APP_SECRET` خامًا — القاعدة التي ينصّ عليها `secret-crypto.service.ts:26` نثرًا). ثلاث إضافات على شكل magic-link:
- **`urlKey`** — nonce لكل صفّ. تدويره **يقتل كل الروابط المعلّقة فورًا**. الروابط السحرية تعيش ١٥ دقيقة فلا تحتاجه؛ رابط أطول يحتاجه قطعًا.
- **`viewerId`** — يربط الرابط بمن طلبه، فتاجر يلصق رابطه في محادثة لا يسلّم طرفًا ثالثًا رابطًا عاملًا، والرابط المسرَّب منسوب.
- **النقاط الفاصلة** — لأن الوصل المباشر يجعل `("ab","1")` و`("a","b1")` يتصادمان.

**المسار `GET /bank-transfers/receipts/:id` بلا حارس Nest عن قصد**: المتصفّح لا يستطيع وضع ترويسة `Authorization` على `<img src>` أو رابط تنزيل — وهو بالضبط سبب وجود `WhatsAppQrTicketGuard`. لكن التوقيع **تذكرة دخول لا حدّ**؛ الحدّ خمس خطوات داخل المعالج:

1. فحص الانتهاء (مقارنة عدد واحدة للحالة الشائعة) → **410**
2. فحص الطول ثم `timingSafeEqual` → 404
3. تحميل التحويل والطلب تحت `SOFT_DELETE_WHERE` → 404
4. `urlKey` الموقَّع ما يزال يساوي `transfer.receipt_url_key` → 404 — **هذا هو السحب**
5. **إعادة تشغيل `assertCanViewReceipt` على القاعدة الحيّة** → 404

الخطوة الخامسة هي المبرّر الكامل لخدمة الملفّ بأنفسنا: تاجر باع متجره يفقد الوصول **فورًا**، لا بعد أسبوع. الـCDN لم يسمع بجدول `shops` قطّ.

**كل فشل 404 لا يفرّق** بين «لا يوجد» و«ليس لك» و«توقيع خاطئ» — نفس قاعدة منع العدّ المنصوص عليها في `orders.service.ts:3577-3580`. رابط يردّ 403 على «موجود لكن ليس لك» هو **عرّاف** يكشف أي معرّفات طلبات تحمل تحويلًا بنكيًّا.

**الترويسات:** `Cache-Control: private, no-store` · `Referrer-Policy: no-referrer` (المسار الرئيسي الذي يهرب منه اعتماد محمول في URL) · `X-Content-Type-Options: nosniff` · `Content-Security-Policy: default-src 'none'; sandbox`. **PDF بـ`Content-Disposition: attachment`** لا `inline`: PDF معروضة داخليًّا تعمل في عارض المتصفّح على **أصلنا**، فملفّ مصنوع بجافاسكربت مضمّنة يصير same-origin مع الـAPI.

**لا مصغّرات إطلاقًا** — لا للـPDF (`ThumbnailService.IMAGE_MIMES` يستثنيها وsharp لا ترسّم PDF بلا poppler) ولا للصور: `ThumbnailService.generate` **بلا try/catch** وsharp ترمي على صورة مبتورة، وكائن ثانٍ يعني صنف يتامى ثانيًا وعطلًا ثانيًا بعد إثبات البايتات.

### 8.4 مدّة الرابط — التوصية تخالف المواصفة

المواصفة تقول ٧ أيام. **التوصية: 900 ثانية** (`RECEIPT_LINK_TTL_SECONDS`).

السبب: الرابط **يُسَكّ في كل قراءة** من قِبل منادٍ صودق عليه للتوّ، فسبعة أيام لا تشتري شيئًا فوق ربع ساعة — بينما تحوّل كل إيصال شوهد إلى **اعتماد محمول عمره أسبوع** يجلس في تاريخ المتصفّح وترويسات Referer. وقراءة قائمة واحدة للطابور **تسلّم N اعتمادًا دفعة واحدة**.

هذا سؤال مفتوح — §19 — لأن الجواب يتغيّر لو كان أحد يرسل هذه الروابط بالبريد.

### 8.5 حياة البايتات

- **الرفض لا يحذف الإيصال.** الصفّ المرفوض تاريخ يراه المشتري، والإيصال هو **الدليل على سبب الرفض**؛ إتلافه يجعل الرفض غير قابل للتدقيق. وهذه مخالفة مقصودة لـ`AttachmentsService.delete()` التي تتلف الملفّ في حذف «ناعم».
- **الحذف الناعم للتحويل لا يحذف الإيصال.**
- **الحذف الناعم لـ`ShopBankAccount` لا يصل إلى الإيصال إطلاقًا** — الإيصال معلّق على التحويل، والـFK هو `SetNull`، واللقطة تحمل التفاصيل.
- المتلف الوحيد وظيفة احتفاظ مؤرّخة تضع `receipt_purged_at` وتُبقي الصفّ والبيانات الوصفية، فتقول الواجهة «أُتلف» بدل عرض رابط مكسور. **مدّة الاحتفاظ سؤال مفتوح.**

---

## 9. واجهة المتجر (storefront)

### 9.1 الشاشات

| الشاشة | ما يتغيّر |
|---|---|
| `/[shopSlug]/checkout` | تبويب دفع ثالث. `PAYMENT_METHODS` يصير **مشتقًّا** من `shopPaymentOptions` بدل زوج مثبّت. تحته لوحة تعليمات: منتقي بنك (شعار + اسم مترجم) ثم تفاصيل الحساب مع **نسخ بضغطة** لكلّ من IBAN ورقم الحساب |
| `OrderPlacedDialog` | فرع ثالث. اليوم يقول لكل طلب غير سترايب إنه «يدفع عند الاستلام» — وهذا **خطأ صريح** أمام مشترٍ عليه أن يحوّل |
| `/[shopSlug]/account/orders/[id]` | قسم جديد: تفاصيل الحساب مجدّدًا + المبلغ + «حوّل ثم ارفع الإيصال»، ثم بعد التقديم حالة «قيد المراجعة»، وبعد الرفض **السبب** وزرّ إعادة تقديم. وقائمة المحاولات من الأحدث |
| حوار رفع الإثبات | `sender_name` · `sender_bank_code` · `transfer_reference` · `transferred_at` · الملفّ · ملاحظة. مخطّط zod يعكس تحقّق الخادم حرفيًّا |
| `shop-footer.tsx:502-531` | شريط شارات الدفع يصير **واعيًا بالمتجر**. تعليقه اليوم ينصّ على أن القائمة «ليست إعدادًا لكل متجر» — وهذه الميزة تجعل التعليق كاذبًا |

### 9.2 ثلاثة إصلاحات قائمة يجب أن تُشحن في **نفس** الالتزام

هذه ليست تجميلًا. هي أعطال قائمة تجعلها هذه الميزة **مرئية على شاشة مال**:

1. **`PAYMENT_LABEL_KEY`** مفهرَس على `pending|authorized|paid|failed` بينما الخادم يرسل `payment-*` خامة — فلا يطابق أي قيمة اليوم ويسقط دائمًا إلى «الدفع معلّق». على طلب **مرفوض** هذا يقول للمشتري عكس الحقيقة.
2. **`displayStatus`** مفهرَس على قيم بلا بادئة `order-`.
3. **`SessionSync`** في `apollo/client.tsx:73-81` — الحقل الجذري الجديد يجب أن يدخل قائمة الإخلاء. إغفاله **تسريب بيانات عابر للمتاجر لا عطل بصريّ**، ولن يظهر في أي اختبار.

### 9.3 الرفع — أوّل ملفّ في هذا التطبيق

`grep -rn "FormData|type=\"file\"|multipart" apps/storefront/src` يعيد **لا شيء**. فهذا أوّل مدخل ملفّ في الـstorefront.

`XMLHttpRequest` لا `fetch` (رفع 5MB على بيانات جوّال يريد `onprogress`)، والترويسات باليد: `Authorization` + `X-SHOP`.

> 🔴 **الثغرة التي ستكسر بصمت:** XHR خامّ **يتجاوز سلسلة روابط Apollo كاملة** (`shared/apollo/links.ts:96-177`) — لا تجديد `TOKEN_EXPIRED` ولا إعادة تشغيل ولا `forceLogout`. مشترٍ ترك التبويب مفتوحًا بعد `JWT_ACCESS_EXPIRES_IN` يحصل على 401 عارية بلا تعافٍ. العلاج: على 401 نادِ `/api/auth/refresh` مرّة، أعد قراءة التوكن، أعد المحاولة مرّة، ثم `forceLogout`. **هذا أكثر ما سيُسقَط أثناء التنفيذ لأنه يبدو حشوًا.**

وأيضًا: `e.target.value = ""` بعد قراءة المدخل، وإلّا فاختيار نفس الملفّ مرّتين لا يطلق حدث `change` (مسجَّل في `brand-image-field.tsx:205-207`).

### 9.4 i18n وRTL

~٦٨ زوج مفتاح جديد في `en.json` و`ar.json` بنفس المسارات المسطّحة ونفس أسماء وسائط ICU، وإلّا **يسقط `npm test`** على `shared/i18n/__tests__/messages.test.ts` (السلاسل الفارغة مرفوضة أيضًا).

**الـIBAN نصّ LTR داخل صفحة RTL** — يُغلَّف بـ`dir="ltr"` وخطّ أحاديّ التباعد، ويُعرَض بمجموعات من أربعة **للقراءة فقط** بينما تبقى القيمة المخزَّنة والمنسوخة بلا مسافات.

---

## 10. لوحة التاجر (vendor)

### 10.1 لوحة الإعدادات

معرّف قسم `payments` **موجود أصلًا** في `settings-sections.ts:66` بأيقونة `CreditCard` وتسميتين عربية وإنجليزية وله مدخل SLUGS — فالعمل يرفعه عن كونه عنصرًا نائبًا **بلا** تغيير معرّف أو slug أو تنقّل i18n.

**بطاقة الحسابات** — قائمة، حوار إنشاء/تعديل، منتقي بنك، مفتاح تفعيل، ترتيب عرض، تأكيد حذف.

> **قاعدة شريط الحفظ:** الشريط العامّ متجر Zustand **واحد**؛ مكوّنان يناديان `show()` يتصارعان، وإغلاق الخاسر القديم `onSave` يظلّ يُطلَق. القرار: **بطاقة المفتاح تملك الشريط وحدها**، وكل CRUD للحسابات في حوارات **بشرائط حفظ خاصّة بها** — وهو الاستثناء الموثّق في `zone-form-dialog.tsx:30-37`.

**مفتاح التفعيل يصل في المرحلة ٦ لا قبلها.** مفتاح لا يفعل شيئًا لثلاث مراحل أسوأ من غيابه. وحين يصل يعرض الحالة **الثلاثية** التي تعرضها المواصفة صراحةً: مفعَّل لكن **غير متاح** لعدم وجود حساب نشط.

### 10.2 طابور المراجعة

`/store/[shopSlug]/orders/bank-transfers` على شاكلة `orders/returns/page.tsx`، ببنية الجداول المشتركة (`DataTableCard` وأخواتها) — لا `div` محدود مكتوب باليد ولا أزرار سابق/تالٍ خاصّة.

الأعمدة: المشتري · المبلغ · «دُفع إلى» (من **اللقطة**) · تاريخ التحويل · الحالة · الإيصال · إجراءات. مرشّح حالة يفتح على `pending`.

- **حوار الاعتماد يسمّي أثر المال** بدل «هل أنت متأكّد».
- **حوار الرفض يفرض سببًا** ٣–٥٠٠ حرف، ويقول صراحةً إن المشتري سيراه.
- **زرّا الاعتماد والرفض يُخفَيان** على صفّ غير `pending`، لا يُعرَضان ثم يُرفَضان.
- **`fetchPolicy: 'no-cache'` على قراءة `receipt_url`.** إسقاطها هو **أرجح طريقة تُشحن بها الميزة مكسورة بمكر**: تعمل تمامًا في العرض الأوّل، ثم يخدم العرض الثاني رابطًا ميّتًا وصورة مكسورة بلا خطأ.

### 10.3 تفاصيل الطلب والتنقّل

بطاقة في العمود الأيسر بجوار `OrderRefundsCard`. ومدخل «التحويلات البنكية» داخل مجموعة الطلبات في `app-sidebar.tsx`.

> ⚠️ `sidebar.transfers` بالعربية **«التحويلات»** أصلًا (تحويلات المخزون، تحت المنتجات). المدخل الجديد **يجب** أن يكون «التحويلات البنكية» وإلّا قرأت شجرتا الطلبات والمنتجات كتكرار.
>
> ⚠️ `order-summary-card.tsx:77` يطبع البوّابة **خامّة** اليوم. الشحن بلا إصلاح `gatewayLabel()` يضع النصّ الحرفيّ `BANK_TRANSFER` أمام كل تاجر على كل طلب من هذا النوع.
>
> ⚠️ **لا اختبار تكافؤ en/ar في تطبيق التاجر** (الـstorefront عنده واحد). مفتاح عربي مفقود لا يُسقط شيئًا في CI ويعرض مسار المفتاح الخام لتاجر عربي. الرسالتان ذات صيغة الجمع أخطر ما فيه: العربية تحتاج ست فئات ICU حيث تحتاج الإنجليزية اثنتين.

---

## 11. الإشعارات

**الاعتماد على `order.status.changed` وحده يترك المشتري بلا خبر والتاجر بلا إنذار.** ثلاثة أسباب متحقَّق منها:

1. الحدث يصل المشتري عبر معالج واحد فقط — `NotifyLogListener.onOrderStatusChanged` — يكتب صفًّا داخل التطبيق **لا يستطيع الـstorefront عرضه** (لا استعلام إشعارات في `apps/storefront/src` إطلاقًا)، وتفضيل بريده الإلكتروني **افتراضه false**، ووظيفة بريده القديمة **مصرف عديم الأثر** صراحةً.
2. `NotificationDispatchListener` — المسار الوحيد الذي يرسل بريد المتجر المُعنون بالقالب — **لا يشترك في `order.status.changed` أصلًا**.
3. **والرفض لا يغيّر حالة طلب، فلا يطلق شيئًا على الإطلاق** — بينما سبب الرفض في المواصفة «يُعرَض على المشتري» صراحةً.

لذلك: **حدثان جديدان**، بعد الإثبات وبأفضل جهد، مع أربعة معالجات:

| الحدث | الوجهة | القناة |
|---|---|---|
| `bank_transfer.submitted` | التاجر | جرس داخل التطبيق (`NotifyType.PAYMENT`) + بريد الموظّفين |
| `bank_transfer.reviewed` | المشتري | بريد بقالب عبر `NotificationDispatchListener` (`bank_transfer_approved` / `bank_transfer_rejected`) |

كل قالب يحتاج **اللغتين معًا** في `default-templates.ts` — الزوج الناقص يرمي `RESOURCE_NOT_FOUND` **داخل العامل**، فيعيد المحاولة ثلاثًا ثم يستدعي `AlertService`.

> ⚠️ **إضافة `'new_bank_transfer'` إلى `STAFF_EVENTS` تشترك تلقائيًّا بكل مستلم قائم في كل متجر**، لأن `recipientsForEvent` يعامل `events: []` كـ«مشترك في كل شيء» وواجهة التاجر تنشئ المستلمين هكذا دائمًا — **لا مربّعات لكل حدث اليوم**. سؤال مفتوح.
>
> ⚠️ `NotifyType.PAYMENT` يغطّي أصلًا المسحوبات والنزاعات، و`NotificationPreference` مفهرَس على `(user_id, notify_type)` — فتاجر كتم PAYMENT يكتم تنبيهات التحويل أيضًا. نوع مخصّص هو الجواب النظيف لكنه يكلّف قيمة Prisma enum (بملفّ SQL يدويّ قائم بذاته) وcodegen في ثلاثة تطبيقات.
>
> ⚠️ `Order.language` يسقط إلى **العربية** لا الإنجليزية (`FALLBACK_TEMPLATE_LANG='ar'`)، فطلب بلا لغة يحصل على نصّ عربي.

---

## 12. الأمن والصلاحيات

**الحارسان معًا ليسا حدًّا للملكيّة، وهذه أهمّ جملة في القسم:**

- `PermissionsGuard` يطابق بـ`.some()` (`permissions.guard.ts:45`)، وكل تاجر يملك `manage_own_shop`.
- `ShopHeaderGuard` يحلّ **أي** متجر بالـslug و**لا يقارن `owner_id` أبدًا** (منصوص عليه في `shop-ownership.guard.ts:9-16`).
- `ShopOwnershipGuard` يعيد true لـ`admin` **و**`super_admin` (:31) — فهو ليس فحص ملكية نقيًّا.
- `RequireShopGuard` يمرّر `super_admin` **بلا سياق متجر**، فـ`@CurrentShop()` قد يكون `null` رغم أن نوعه يبدو غير قابل لذلك.

لذلك **كل عملية مفهرَسة بـ`id` تحلّ الملكيّة من الصفّ لا من الترويسة**. تاجر يملك المتجر A يستطيع إرسال `X-SHOP: A` (يمرّ الحارسان) مع `id` يخصّ المتجر B. هذا هو الـIDOR الذي **أُصلح مرّتين في هذا المستودع** — `settings.resolver.ts:51-56` و`withdrawals.service.ts:150-160`. الشكل الصحيح موجود حيًّا في `ReturnsService.assertCanView`/`assertCanManage` + `ownedShopIds()`.

**«المشتري لا يعتمد أبدًا» فحص خدميّ صريح**، لا نتيجة مفترضة لنطاق المتجر.

### 12.1 التاجر لا يعتمد تحويلًا على طلب قدّمه هو

`assertCanReview` الذي يقبل أي منادٍ يحوي `ownedShopIds` متجرَه **لا يكفي**. `createOrder` بلا أي فحص صلاحية، و«تاجر يشتري من متجر آخر زبون عاديّ» — لكن هذا المنطق يجب أن يُطبَّق على **جهة المراجعة** لا على جهة القراءة فقط.

بدونه: تاجر يطلب من متجره، يرفع إيصالًا ملفّقًا، **ويعتمده بنفسه**. فيتحرّك GMV وعدد الطلبات وتحليلات «أفضل المتاجر» وأي قياس خطّة لكل طلب — على **مال لم يوجد قطّ**.

والشكل جاهز في المستودع ولم يُعَد استعماله: `UsersService.assertNotSelf` (`users.service.ts:88`، مُستدعى في :437 و:526 و:586). القاعدة: إن كان `transfer.customer_id === user.id` والمنادي ليس `admin`/`super_admin` → `AppException.forbidden()`.

### 12.2 `cancelOrder` يرفض بينما توجد مطالبة قائمة

`order-processing → order-cancelled` انتقال مشروع و`cancelOrder` يقبل الزبون المالك — فطفرة واحدة تفكّ المخزون والكوبون والمحفظة على طلب **قيل للتاجر إنه مدفوع والمال في بنكه فعلًا**، بلا أي سجلّ استرداد.

إخفاء الزرّ في الواجهتين **مرآة لا حدّ**؛ الطفرة قابلة للنداء مباشرةً. فداخل `cancelOrder`، بعد تحميل الطلب وقبل فحص الانتقال: يُرفَض لمنادٍ غير أدمن حين يوجد `OrderBankTransfer` حالته `pending|approved` — `BANK_TRANSFER_OUTSTANDING` (422). **الأدمن يحتفظ بالقدرة**، لأن إلغاءً مصحوبًا باسترداد حقيقيّ إجراء دعم مشروع.

### 12.3 قناع التدقيق أضعف مما يبدو

`AuditLogService.SENSITIVE_KEYS` يغطّي password/token/secret/api_key/pin/private_key/refresh_token/access_token — **ولا يغطّي `iban` ولا `account_number`**. و`audit_logs` يقرأه كل من يملك `manage_users`.

**والأهمّ أن توسيع القائمة وحده لا يكفي:** `maskSensitive` (:54-63) يمشي على `Object.entries` **مستوى واحدًا** ويطابق المفتاح **حرفيًّا**، ثم يسند القيمة كاملة. فأي نداء يسجّل `new_values: { bank_account_snapshot: { iban, … } }` يكتب الـIBAN صريحًا مهما طالت القائمة.

القاعدة إذن **مزدوجة**:
1. توسيع `SENSITIVE_KEYS` بـ`iban` و`account_number` — رخيص، ويمسك حالة الـCRUD حيث المفتاح في المستوى الأعلى.
2. **قاعدة معلنة في الوحدة:** كل نداء تدقيق في هذه الميزة يسجّل معرّفات و`amount_cents` و`status` **وعلى الأكثر `iban_last4`** — **أبدًا اللقطة ولا مسار الإيصال**. مع اختبار يؤكّد أن حمولة التدقيق للتقديم والمراجعة وإنشاء الحساب **لا تحوي `iban` ولا مسار تخزين على أي عمق**.

**الحدّ من المعدّل:** لا يوجد `APP_GUARD` عامّ في المستودع (`grep -rn APP_GUARD src/` يعيد صفرًا)، فإعداد `ThrottlerModule` **لا يحرس شيئًا** ما لم يذكر المعالج حارسًا. `POST /attachments` **غير محدود المعدّل فعليًّا اليوم**. مسار الرفع الجديد يذكر `GqlThrottlerGuard` صراحةً مع `@Throttle({ limit: 5, ttl: 60_000 })`، وإلّا فالمزخرِف تزييني ونقطة 5MB مفتوحة لأي حساب.

---

## 13. المراحل

المبدأ الذي يرتّبها: **يجب ألّا تكون الطريقة قابلة للعرض عند الدفع قبل أن يستطيع المتجر تسجيل حسابات، والمشتري رفع إثبات، والتاجر المراجعة.** فسطح العرض أخير، ويُشحن خلف راية بيئة فوق ذلك.

| # | المرحلة | مظلمة؟ | معيار الخروج |
|---|---|---|---|
| **0** | كتالوج البنوك (قراءة عامّة) | ✅ كليًّا | `banks(locale:"ar")` يعيد ١٣ صفًّا لطلب غير مصادَق بلا X-SHOP |
| **1** | المخطّط + بذرة التخزين الخاصّ | ✅ كليًّا | الفهرس الجزئي ظاهر في `\d`؛ اختبار يثبت أن الإيصال يهبط **خارج** `UPLOAD_DIR`؛ `GET /receipts/anything` يردّ 404 بلا stack |
| **2** | حسابات المتجر (back-end) | ✅ | تاجر يُنشئ/يعدّل/يحذف على متجره ويحصل على **NOT_FOUND** لا FORBIDDEN على متجر غيره |
| **3** | لوحة إعدادات التاجر (حسابات فقط) | ظاهرة لكن خاملة | IBAN حقيقي يُسجَّل ويُعرَض بمجموعات أربع بينما المخزَّن بلا مسافات |
| **4** | التقديم + الطابور (back-end) | ✅ | `submit` يرفض **كل** طلب في القاعدة لأن لا طلب بوّابته BANK_TRANSFER بعد |
| **5** | طابور المراجعة + بطاقة الطلب (vendor) | ✅ طابور فارغ | الاعتماد يحرّك الطلب؛ الرفض يطالب بـ٣–٥٠٠ حرف؛ الإيصال يتوقّف عن الفتح بعد انتهاء المدّة |
| **6** | **سطح العرض** — الوحيدة التي يراها المشتري | يُشحن بـ`BANK_TRANSFER_ENABLED=false` | الدورة الكاملة على متجر واحد مبذور |

**المرحلة ٦ هي حيث يجتمع كل شيء:** عضو الـenum، حالة `determineInitialStatuses`، حارس الإتاحة، رفض `createPaymentLink`، `shopPaymentOptions`، مفتاح التاجر، تبويب الـstorefront، وإصلاحات §9.2 الثلاثة — **في التزام واحد**، لأن نصفها معًا يعني طلب تحويل بنكي معروضًا بنصوص خاطئة.

---

## 14. الاختبارات

### back-end (jest)

- **الكتالوج:** أربع لغات مكتملة لكل بنك · رموز فريدة · `other` بـswift وicon فارغين · كل بنك آخر له `icon` يطابق `/^\/banks\/<code>\.svg$/` · `bankCatalogue('tr')` تركية و`('xx')` إنجليزية. (على شاكلة اختبار تكافؤ القاموس في `image-gen.service.spec.ts:1151-1174`، الموجود لأن السقوط يخفي ترجمة ناقصة عن أي اختبار عرض.)
- **IBAN:** SA صالح · رقمان مبدَّلان يفشلان · جولة أحرف صغيرة بمسافات عبر `normalizeIban`.
- **الحسابات:** لا IBAN ولا رقم → 422 · IBAN يفشل MOD-97 → 422 · `other` بلا `bank_name` → 422 · **تاجر متجر آخر يحصل على 403/404 حتى بـX-SHOP الخاصّ به** · مسح المعرّف الوحيد → 422، ومسح واحد من اثنين ينجح · الحذف ناعم.
- **الإتاحة:** مفتاح مفعَّل بلا حساب نشط → `available: false` · `createOrder` بـBANK_TRANSFER على متجر مطفأ → 422.
- **الإنشاء:** `createOrder` ناجح ⇒ `order-pending` + `payment-awaiting-for-approval` + **صفر صفوف `PaymentIntent`** · سلّة متعدّدة المتاجر → 422.
- **التقديم:** المبلغ المسجَّل = `order.total_cents` **حتى لو أرسل العميل غيره** · `transferred_at` مستقبلية → 422 · أقدم من ٦ أشهر → 422 · طلب ليست بوّابته تحويلًا → 422 **ولا ملفّ يتيم على القرص** · تقديم ثانٍ بينما واحد معلّق → **409** · حساب عُطّل بعد الاختيار → 422.
- **المراجعة:** المشتري يعتمد تحويله → 403 · تاجر متجر آخر → 403 · **تاجر يعتمد تحويلًا على طلب قدّمه هو في متجره → 403** (§12.1) · الاعتماد ⇒ `payment-success` + `order-processing` · **طلب في `order-out-for-delivery` يحتفظ بحالته** · **طلب أُلغي بعد التقديم → 422 ولا يُعلَّم مدفوعًا** (§7.6) · اعتماد معتمَد → 409 · رفض بلا سبب → 422 · بعد الرفض يُقبَل تقديم جديد · الطابور يعرض هذا المتجر فقط ويرشّح `pending` افتراضيًّا · قائمة الطلب من الأحدث وتشمل المرفوضة.
- **الإلغاء:** `cancelOrder` من المشتري بينما مطالبة `pending` أو `approved` قائمة → 422 `BANK_TRANSFER_OUTSTANDING`؛ **الأدمن يمرّ** (§12.2).
- **التدقيق:** حمولة التدقيق للتقديم والمراجعة وإنشاء الحساب **لا تحوي `iban` ولا مسار تخزين على أي عمق** — لأن `maskSensitive` يمشي مستوى واحدًا ويطابق حرفيًّا (§12.3).
- **العموم:** `shopBankAccounts` بلا توكن → 401؛ و`shopPaymentOptions` بلا توكن ينجح و**لا يحوي `iban` ولا `account_number` في حمولته إطلاقًا** (§6.1).
- **الإيصال:** الرابط موقّع و`receipt_path` **لا يظهر في أي حمولة** · رابط منتهٍ → 410 · توقيع معبوث → 404 · تدوير `urlKey` يقتل رابطًا ما زال صالحًا زمنيًّا · مشترٍ آخر برابط صالح شكليًّا → 404.

### التزامن (`test/concurrency/`، على Postgres حقيقيّ)

تقديمان متزامنان على طلب واحد ⇒ **صفّ واحد بالضبط**. اعتمادان متزامنان ⇒ واحد ينجح وواحد 409. وتأكيد أن ترتيب الأقفال `orders` ثم `order_bank_transfers` في المسارين. هذه الطبقة هي **المكان الوحيد** الذي يكشف غياب الفهرس الجزئي، واختبارات الوحدة بـ`$transaction` مموّهة عمياء عنه.

> ⚠️ **`describeGuardChain` لا يصلح لمعظم عمليّات هذه الوحدة.** المساعد يؤكّد `toContain(ShopOwnershipGuard)` لكل عملية يمشي عليها مهما كانت الخيارات — فمُحلّل يحلّ الملكيّة **من الصفّ** عمدًا (كما تفعل returns وrefunds وwithdrawals، ولا واحد منها ينادي المساعد) لا يمرّ إلّا بإدراج كل عملية في `publicOps` بـ`minOps: 0`، وعندها **يصير التأكيد فارغًا وهو يبدو صارمًا**. يُستعمل على `ShopBankAccountsResolver` وحده، والبقيّة اختبارات تفويض خدميّة صريحة.

### vendor / storefront (vitest)

تكافؤ مفاتيح en/ar · إخفاء أزرار المراجعة على صفّ غير معلّق · حالة الفراغ **المرشَّحة** مقابل حالة «لا تحويلات قطّ» (خلطهما يقول لمتجر مشغول إنه لم يستقبل تحويلًا قطّ) · مخطّط zod يرفض التاريخ المستقبلي ونوع الملفّ والحجم · `OrderPlacedDialog` يعرض الفرع الثالث.

---

## 15. التوثيق و TODO.md

إلزاميّ في **نفس** التغيير الذي يجعل كلًّا منه صحيحًا:

| الملفّ | المحتوى |
|---|---|
| `back-end/docs/features/bank-transfers.md` | نظرة عامّة · مخطّط Mermaid **واحد** · نموذج البيانات · جدول العمليات · التدفّقات · الصلاحيات وX-SHOP · رموز الأخطاء · الملفّات الرئيسية · ملاحظات — ≤١١٠ سطر |
| `back-end/docs/features/api/bank-transfers.md` | العقد الكامل لكل عملية: الحرّاس، الوسائط، كل حقل بقيوده، نوع العودة، رموز الأخطاء، مثال واقعيّ + جدول أخطاء موحَّد. **بلا حدّ أسطر** |
| `back-end/docs/features/README.md` | صفّ في الفهرس |
| `back-end/docs/features/api/README.md` | صفّ لكل عملية |
| `back-end/docs/features/orders.md` | تحديث: البوّابة الجديدة وحالة الدفع |
| `back-end/docs/features/checkout.md` | تحديث: `shopPaymentOptions` |
| `back-end/docs/10_deployment/README.md` | **ملفّ SQL اليدويّ في قائمة الخطوات الإلزامية** |
| `apps/vendor/docs/features/…` · `apps/storefront/docs/features/…` | وثيقة ميزة لكلٍّ |

و`TODO.md`: مدخل `###` جديد أعلى **Back-end & API** بنثر يسجّل ما شُحن ثم مربّعاته المفتوحة، مع تحديث عدّاد المنطقة وصفّ **Total** في جدول `## Index`.

**الفحوصات على كل مرحلة تمسّ المخطّط:**

```bash
npm run schema:generate && npm run schema:check   # back-end — لا تحتاج قاعدة
npx turbo run codegen                              # الثلاثة تطبيقات، لا الـstorefront وحده
npm run check:di && npm run check:drift && npm test
npm run lint                                       # back-end — باليد، فهو ليس في CI
npx turbo run lint typecheck test build
```

> 🔴 **`schema.gql` قديم يفشل بصمت وبكلفة.** التطبيقات الثلاثة تولّد أنواعها من الملفّ **المُلتزَم**، فتتّفق أنواعها مع مخطّط قديم ويبقى `tsc` أخضر بينما الاستعلام الحقيقيّ يسقط وقت التشغيل بـ`Cannot query field`. و`BankTransferStatus` هو الـenum الأوّل في هذه الميزة الذي **يصل** إلى `schema.gql` فعلًا (بخلاف `PaymentGateway`)، فهذه المرحلة تحديدًا تحتاج الدورتين معًا.

---

## 16. متغيّرات البيئة

| المتغيّر | الافتراض | ملاحظة |
|---|---|---|
| `BANK_TRANSFER_ENABLED` | `false` | مفتاح إيقاف المنصّة، يُقرَأ **داخل** فحص الإتاحة |
| `RECEIPT_STORAGE_DRIVER` | `db` | `db` \| `s3-private`. **يرفض `bunnycdn`** |
| `PRIVATE_UPLOAD_DIR` | `private-uploads` | **يجب ألّا يكون `UPLOAD_DIR` ولا ابنًا له** — الشجرة تلك تُخدَم علنًا |
| `PRIVATE_S3_BUCKET` | — | **غير** الـbucket خلف `S3_CDN_URL` |
| `ALLOW_LOCAL_PRIVATE_RECEIPTS` | — | `1` وحدها تسمح بقرص محلّي في الإنتاج |
| `RECEIPT_LINK_TTL_SECONDS` | `900` | المواصفة تقول ٧ أيام — §8.4 |
| `RECEIPT_MAX_BYTES` | `5242880` | حدّ multer يوضَع **أعلى** منه (6MB) ليأخذ الرفض شكل 422 البيتيّ |

---

## 17. مخاطر معروفة

1. **إحياء `payment-awaiting-for-approval` لأوّل مرّة في الإنتاج.** القيمة موجودة في كل طبقة منذ شهور ولم يكتبها شيء قطّ — فلم يرها أي مرشّح أو شارة أو دلو تحليلات أو قاعدة شريحة **في البرّية**. تُشتَقّ إلى `FinancialStatus.AUTHORIZED`، فهذه الطلبات ستبدأ بالظهور كـ«معتمَدة» على محور المال. تُدقَّق `paidStatuses` (**ثلاث نسخ مثبّتة منفصلة**) و`COUNTED_ORDER_STATUSES` ومرشّحات طلبات التاجر قبل الشحن.
2. **الفهرس الجزئي غير مرئيّ لـ`db push` ولا لـ`check:drift`.** بيئة يدوية تفقد الضمانة بصمت، ولا شيء ينكسر ظاهريًّا — ولهذا بالذات سيُنسى.
3. **`Order.altered_payment_gateway` عمود بوّابة ثانٍ قابل للتعديل** يضبطه `updateOrder`. من يقرّر «هل هذا طلب تحويل بنكي؟» من `payment_gateway` وحده سيخالف واجهة تعرض الاثنين.
4. **لا شيء يُنهي طلبًا مهجورًا في انتظار الاعتماد.** المخزون ورصيد المحفظة واستعمال الكوبون تُستهلك كلّها عند `createOrder`، فمشترٍ يطلب ولا يدفع أبدًا **يحجز بضاعة إلى الأبد**. الطلب **قابل** للإبطال (`payment-awaiting-for-approval` ليست في حارس `voidOrderForFailedPayment`) لكن **لا وظيفة تبطله**. سؤال مفتوح.
5. **الاسترداد على تحويل معتمَد بلا مسار آليّ** — رجل الاسترداد يبحث عن `PaymentIntent` بـ`STRIPE` ويعيد null، فيُتخطّى ويُعاد المال خارج النظام.
6. **عامل إرسال الإشعارات يعيد الرمي بعد `Promise.allSettled`**، فإعادة المحاولة تعيد تشغيل كل القنوات وقد تسلّم بريد اعتماد **مرّتين**. مقبول في مواضع أخرى؛ هنا رسالة مال وسيُبلَّغ عنه كخلل.
7. **`npm run lint` في الـback-end ليس في CI.** وحدة بهذا الحجم هي بالضبط حيث يهبط `any` غير مفحوص ويبقى.
8. **`BankTransfersModule` يستورد `OrdersModule`** فيسحب رسمها البيانيّ كاملًا (Coupons وCart بـforwardRef، Wallets، Balance، ShippingProviders، طابور البريد). `npm run check:di` إلزاميّ قبل اعتبار العمل منتهيًا.

---

## 18. خارج النطاق في v1

- **التحويل البنكي لسلّة متعدّدة المتاجر** — §3.6، ورفض صريح لا إغفال.
- **استرداد آليّ** لطلب تحويل بنكي معتمَد.
- **دور موظّفي المتجر** — لا وجود له في المخطّط؛ «المتجر» = المالك + أدمن المنصّة.
- **بنوك خارج السعودية** بأسمائها الخاصّة — `other` يسجّل الرمز ولا مكان لاسم بنك المشتري.
- **إدارة الكتالوج من شاشة أدمن** — تصميم السجلّ يجعل الترحيل إلى جدول لاحقًا نظيفًا (الرمز يبقى المفتاح واللقطة تبقى المرجع).
- **مصغّرات الإيصالات** — §8.3.
- **رسوم بوّابة** على الطريقة — `GatewayFeeService.resolveFee` يعيد `ZERO_FEE` لبوّابة بلا صفّ، وهذا صحيح لطريقة لا تكلّف المنصّة شيئًا.

---

## 19. أسئلة تحتاج قرارك

1. **مدّة الرابط الموقّع.** المواصفة ٧ أيام؛ التوصية **٩٠٠ ثانية**، لأن الرابط يُسَكّ في كل قراءة فالمدّة الطويلة لا تشتري شيئًا وتحوّل كل إيصال إلى اعتماد محمول عمره أسبوع. **الجواب يتغيّر فقط إن كان أحد يرسل هذه الروابط بالبريد.**
2. **سائق التخزين للإنتاج.** `db` (بايتات في Postgres، بنية تحتية صفر، شحن هذا الأسبوع) أم `s3-private` (يقيس، لكنه يحتاج bucket خاصًّا بسياسة IAM **قبل** النشر)؟ هذا يحجب النشر لا التطوير.
3. **السلال متعدّدة المتاجر.** الرفض مقبول للإطلاق، أم التحويل البنكي متعدّد المتاجر متطلَّب؟ الجواب يغيّر قابلية `shop_id` للـnull — أكبر قرار نطاق في الخطة.
4. **`Order.payment_instructions`** — عمود جديد على أكثر جدول قراءةً في المخطّط. يشتري تعليمات مجمّدة تنجو من حذف الحساب وإشارة «قيل له X ويدّعي Y». يستحقّ؟
5. **إنهاء الطلبات المهجورة.** هل نشحن كنّاسة مجدولة تُبطل طلبات التحويل الأقدم من N يومًا بلا مطالبة معلّقة، وكم N؟ (لم أصمّم واحدة عمدًا — قرار سياسة بكلفة خدمة عملاء حقيقية.)
6. **مدّة الاحتفاظ ببايتات الإيصال** بعد الرفض. مستند محاسبي مساند أم دليل عابر لقرار مراجعة واحد؟
7. **بريد الموظّفين.** إضافة `new_bank_transfer` تشترك تلقائيًّا بكل مستلم قائم في كل متجر (لا مربّعات لكل حدث اليوم). مقبول لحدث مال، أم ننتظر واجهة الاشتراك التفصيليّ؟
8. **`NotifyType` مخصّص** أم الاكتفاء بـ`PAYMENT` (وقبول أن تاجرًا كتم PAYMENT يكتم تنبيهات التحويل)؟
9. **`BIC` لـ`gib` و`stc_pay`** يحتاجان تحقّقًا قبل الدمج.
10. **نافذة الـ٦ أشهر** لـ`transferred_at` — رقم المواصفة بلا سبب مذكور. سياسة حقيقية أم حدّ اعتباطيّ؟ إن كان اعتباطيًّا فليكن ثابتًا معلَّقًا لا قاعدة لا يستطيع أحد الدفاع عنها أمام تاجر دفع زبونه قبل سبعة أشهر.

---

## المصادر

- المواصفة المصدر (نظام Laravel آخر): `BankTransferController` · `ShopBankAccountController` · `BankTransferPolicy` · `ShopBankTransfer` · `BankEnum`
- المستودع: `back-end/src/orders/` · `checkout/` · `payment-intents/` · `attachments/` · `returns/` · `refunds/` · `magic-link/` · `common/guards/` · `prisma/schema.prisma`
