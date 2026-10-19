# P02-T01 — جرد العمليات المنشورة

**Last updated:** 2026-09-16 · مصدر الجرد: `back-end/src/**/*.controller.ts` و`back-end/src/schema.gql`. جدول GraphQL الكامل مدمج أدناه (يُعاد توليده بـ`node test/live/classify-ops.cjs`). إثبات A/B: `back-end/test/live/p01-p02.live-spec.ts` ضد Docker المحلي `zaydak` (**30/30** في آخر تشغيل موثّق). **نصف التوثيق (T10):** عقود auth/scoping للأسطح عالية الأثر محدّثة في `back-end/docs/features/` و`api/`. **مراجعة مستقلة للجرد لم تجرِ** — لا يغلق المنفّذ صندوق المراجعة وحده.

التصنيف: `public` زائر بلا JWT؛ `user` هوية المتصل فقط؛ `shop` مورد داخل متجر الـ`X-SHOP` المحلول؛ `admin` منصة؛ `webhook` مزوّد يوقّع الطلب.

عمود الإثبات: اختبار حيّ أو وحدة، وإلا `pending T09/T10`.

## REST وSSE

| العملية | الدور | النطاق | مصدر المعرّف | الحراس | قيد الخدمة | إثبات |
|---|---|---|---|---|---|---|
| `POST /webhooks/replicate` | webhook | تنبؤ الصورة | `provider_prediction_id` + HMAC | لا JWT؛ تحقق توقيع | `applyPrediction` يعيد التسليم المكرر | — |
| `POST /attachments` | user | مرفقات المتصل؛ `shop_id` إن وُجد | `CurrentUser` + `CurrentShop` | `JwtAuthGuard`, `ShopHeaderGuard` | `uploadMany` | — |
| `POST /attachments/from-url` | user | كما فوق | كما فوق | كما فوق | `uploadFromUrl` | — |
| `POST /attachments/:id/replace` | user | صف المرفق | path `id` | JWT + `ShopHeaderGuard` | `assertOwnership` | `attachments.service.spec.ts` |
| `DELETE /attachments/:id` | user | صف المرفق | path `id` | JWT | `assertOwnership` | `attachments.service.spec.ts`؛ live 2026-09-16 |
| `POST /bank-transfers/orders/:orderId/receipt` | user | طلب المتجر | path + `X-SHOP` محلول | `JwtAuthGuard`, `ShopHeaderGuard`, throttle | الخدمة تربط الإيصال بالطلب | — |
| `GET /bank-transfers/receipts/:id` | user | إيصال | path `id` | JWT + shop | ملكية الإيصال | — |
| `GET /api/v1/segments/:id/export.csv` | shop | شريحة المتجر | path `id` + `CurrentShop.id` | JWT, permissions, shop, ownership | `exportToResponse(id, shop.id)` | P02-T04؛ live A/B 2026-09-16 |
| `GET /faqs` `GET /faqs/:id` | public | متجر محلول | `CurrentShop.id` | `ShopHeaderGuard`, `RequireShopGuard` | `shop_id` | P02-T05 GraphQL؛ REST محلول 2026-09-16 |
| `POST/PUT/DELETE /faqs…` | shop | FAQ المتجر | `CurrentShop.id` + path | JWT, permissions, shop, ownership | `assertShopScopedMutation` | P02-T05 |
| `GET /languages` | public | كتالوج المنصة؛ نطاق اختياري | `CurrentShop.id` إن وُجد | `ShopHeaderGuard` | `shop_id` عبر `shopLanguage`؛ slug مجهول → `Shop not found` | `languages.controller.spec.ts`؛ live 2026-09-16 |
| `GET /languages/:id` | public | صف لغة عام | path | لا | بلا `shop_id` على النموذج | مقبول ككتالوج |
| `POST/PUT/DELETE /languages…` | admin | كتالوج | path | JWT + `manage_all_shops` | — | — |
| `GET /lookups` | public | قوائم مساعدة | `CurrentShop.id` إن وُجد | `ShopHeaderGuard` | locales عبر `shopLanguage` | `lookups.controller.spec.ts`؛ live 2026-09-16 |
| `GET /reviews` `GET /reviews/:id` | public | متجر محلول | `CurrentShop.id` | `ShopHeaderGuard`, `RequireShopGuard` | `shop_id` | محلول 2026-09-16 |
| `POST/PUT /reviews…` | user | مراجعة المتصل داخل المتجر | `CurrentShop.id` + `user.id` | JWT + shop | `{id, shop_id, user_id}` على التحديث | — |
| `DELETE /reviews/:id` | admin | مراجعة المتجر | `CurrentShop.id` | JWT + `manage_all_shops` + shop | `shop_id` | — |
| `POST /webhooks/shipping/:provider/:accountId` | webhook | حساب شحن | path + توقيع | لا JWT | التحقق من الحساب | — |
| `POST /short-links` | public/user | رابط قصير | جسم الطلب | throttle + optional JWT | — | — |
| `GET /short-links` | user | روابط المتصل | JWT | `JwtAuthGuard` | نطاق المستخدم | — |
| `GET /short-links/:code` `GET /short/:code` | public | إعادة توجيه | path code | — | — | — |
| `POST /storefront-assistant/stream` | shop | بث مساعد المتجر | `X-SHOP` | shop guards | ملكية المحادثة | — |
| `POST /webhooks/stripe` | webhook | حدث Stripe | توقيع | لا JWT | — | — |
| `POST /webhooks/telegram/:slug` | webhook | بوت المتجر | slug + secret | لا JWT | — | — |
| `POST /vendor-agent/chat/stream` | shop | بث الوكيل | `X-SHOP` + conversation | JWT, permissions, shop, ownership | رفض `conversation_id` مزوّر | P02-T06؛ live SSE 2026-09-16 |
| `POST /vendor-agent/chat/regenerate/stream` | shop | كما فوق | كما فوق | كما فوق | كما فوق | P02-T06 |
| `POST /vendor-agent/chat/resume/stream` | shop | كما فوق | كما فوق | كما فوق | كما فوق | P02-T06 |
| `POST /webhooks/whatsapp/:instance` | webhook | جلسة واتساب | instance + secret | لا JWT | — | — |
| `GET/POST/DELETE /wishlists…` | user | قائمة المتصل | JWT `user.id` | `JwtAuthGuard` على الصنف | بلا متجر | — |
| `GET /notifications/stream` (SSE) | user | إشعارات المتصل | تذكرة لمرة واحدة | ticket guard + throttle | التذكرة تُستهلك لمستخدم واحد | — |
| `GET /whatsapp/qr/stream` (SSE) | shop | QR الربط | تذكرة تحمل `shopId` | ticket guard | التذكرة تُسكّ المتجر | P02-T06 مجاور |
| `GET /whatsapp/inbox/stream` (SSE) | shop | صندوق الوارد | تذكرة `shopId` | ticket guard | الاشتراك بـ`streamShopId` | — |

جدول GraphQL الكامل (دور، نطاق، مصدر النطاق، حراس، صلاحية، ملكية، قيد الخدمة، إثبات) يُولَّد من `schema.gql` + `@UseGuards` ويُدمَج أدناه بين العلامتين. نسخة مطابقة في [`graphql-ops.generated.md`](../../back-end/test/live/graphql-ops.generated.md). إثبات A/B الحيّ: `back-end/test/live/p01-p02.live-spec.ts`. ليس مراجعة مستقلة (T10).

## GraphQL — فوترة التاجر (T04)

| العملية | الدور | النطاق | مصدر المعرّف | الحراس | قيد الخدمة | إثبات |
|---|---|---|---|---|---|---|
| `myPlan` / `myEntitlements` / `myUsage` / `myUsageEvents` / `myUsageSummary` | shop | متجر المالك | `CurrentShop.id` | JWT + header + RequireShop + **ShopOwnershipGuard** | لا قراءة لخطة متجر آخر | live: A على B مرفوضة |
| `myInvoices` | shop | فواتير Stripe للمتجر | `CurrentShop.id` | كما فوق + `MANAGE_OWN_SHOP` | Stripe للعميل المرتبط بالمتجر فقط | live 2026-09-16 |
| `startPlanCheckout` / `openBillingPortal` / `previewPlanChange` / `changePlanSubscription` / `syncMySubscription` / `cancelMySubscription` / `resumeMySubscription` | shop | اشتراك المتجر | `CurrentShop.id` | كما فوق | المتجر المشحون من الترويسة لا من الإدخال | live: لا URL لـ A على B |
| `shopPaymentSettings` / `updateShopPaymentSettings` | shop | أعلام الدفع | `CurrentShop.id` | JWT + perms + ownership | `assertOwnShop` | live: أعلام B بلا تغيير |
| `createShopBankAccount` | shop | حساب بنكي | `CurrentShop.id` | ownership | `shop_id = shop.id` | fixture B |
| `updateShopBankAccount` / `deleteShopBankAccount` | shop | صف الحساب | path `id` + `CurrentShop.id` | ownership + `ownedAccount` + تطابق `shop_id` | لا تعديل لحساب B من A | live |
| `shopBankAccounts` | user | IBANs النشطة للمتجر (checkout) | `CurrentShop.id` | JWT + header؛ `include_inactive` يتطلب مالك | عرض المستفيد للزائر المسجّل في ذلك المتجر مقصود | — |
| `shopPaymentOptions` / `banks` | public | خيارات الدفع / كتالوج البنوك | `CurrentShop.id` / لا | header للخيارات | بلا IBAN في الخيارات | — |
| `bankTransfers` | shop | طابور التحويلات | `CurrentShop.id` | JWT + perms + **ShopOwnershipGuard** | `queue` يتحقق من المالك | live |
| `bankTransfer` / `orderBankTransfers` | user | صف التحويل / طلب | id | JWT | `canView` عميل أو مالك المتجر | — |
| `reviewBankTransfer` | shop | تحويل المتجر | id | JWT + perms | `canReview` مالك لا العميل | — |
| `balanceTransactions` | shop | دفتر المتجر | `CurrentShop.id` | JWT + perms + header | متاجر مملوكة؛ X-SHOP مبدّل → رفض | live |
| `withdrawals` / `withdrawal` | shop/user | طلب سحب (D26 مجمّد) | header / id | JWT؛ الخدمة ترفض متجراً غير مملوك | لا صرف بنكي؛ IDOR مغلق | live |
| `createWithdrawal` | shop | رصيد المتجر | `CurrentShop.id` | ownership + قفل الرصيد | D26 لا يُوسَّع | — |
| `updateWithdrawalStatus` / `deleteWithdrawal` | admin | منصة | id | `MANAGE_ALL_ORDERS` وحدها | audit | — |

السحب الداخلي مجمّد (D26). لا تنفيذ Tap ولا صرف. الاختبار يثبت أن المالك A لا يقرأ/يكتب صفوف B.

## GraphQL — T07 تغطية العزل

| السيناريو | أين يُغلق | إثبات |
|---|---|---|
| غياب `X-SHOP` على عملية متجر | `RequireShopGuard` أو الخدمة | live `myInvoices` بلا ترويسة |
| تبديل `X-SHOP` إلى متجر غير مملوك | `ShopOwnershipGuard` أو رفض الخدمة (`orders`/`refunds`/`shipments`/`balance`/`withdrawals`) | live billing + ledger |
| حساب customer على سطح تاجر | صلاحية أو ownership | live customer على `shopPaymentSettings` / `myInvoices` |
| متجر معلّق | `ShopHeaderGuard` لغير المالك | live FAQ customer على معلّق |
| حذف منطقي | `SOFT_DELETE_WHERE` | live FAQ محذوف |
| معرّف مورد أجنبي مع ترويسة صحيحة | قيد الخدمة (`ownedAccount`، `assertShopScopedMutation`) | live بنك/FAQ/سؤال |

لا `@Headers('x-shop')` خام في المصدر. GraphQL وREST يمرّران `CurrentShop.id` بعد الحارس.

## استثناءات إدارية (صلاحية حصرية + سبب التدقيق)

`PermissionsGuard` يطابق `.some()`. عملية إدارة حقاً تُغلق بصلاحية إدارة **وحدها**. `admin`/`super_admin` يتجاوزان `ShopOwnershipGuard`. `super_admin` يتجاوز `RequireShopGuard` ويُسجَّل `shop_scope_bypass` (حسّاس).

| العملية / المجموعة | الصلاحية الحصرية | سبب التدقيق |
|---|---|---|
| `allPlans`، CRUD الخطط، المشتركين، overrides، `usageSummary`/`usageTopShops` (مع `cost_cents`) | `manage_plans` | تسعير المنصة وهامش التكلفة |
| `updateRolePermissions` / قراءة قوالب الأدوار | `manage_role_permissions` | تغيير صلاحيات كل حاملي الدور؛ D29 extras + إبطال |
| `approveShop` / `disapproveShop` / `setShopsActive` / `restoreShops` / `adminShopDomains` | `approve_shop` أو `manage_all_shops` وحدها | حالة المتجر العامة |
| `createUser` / `adminUpdateUser` / `setUsersActive` / `deleteUser` | `manage_users` | حسابات المنصة |
| `deleteOrder` / `confirmPayment` / `addWalletPoints` / `deductWalletPoints` / `updateWithdrawalStatus` | `manage_all_orders` | مال عبر المتاجر |
| تكاملات المنصة (`integrationConfigs`، اختبار الإرسال، مزامنة واتساب) | `manage_integrations` | أسرار مزوّدين |
| `activityLogs` / `auditAnomalies` | `manage_users` | سجل حسّاس |

الوصول الإداري عبر `RequireShopGuard` بدون ترويسة يكتب `AuditAction.ACCESS` على `shop_scope_bypass`. طفرات الإدارة تمرّ بـ`AuditLogService` حيث الخدمة تسجّل.

حقول لم يلتقطها المصنّف سابقاً (`savedPrompts` باسم صريح، `importProductsCsv`، سطر وصف `Mint` الوهمي) مذكورة في الجدول المولَّد أو مُتجاهَلة إن لم تكن حقلاً.

T01: كل Query/Mutation في المخطط مصنَّف في الجدول أدناه. قيد الخدمة داخل الملف غير مستنتج آلياً إلا حيث في خريطة المصنّف؛ الباقي «header shop; service may re-check» أو ما يعادله، ويُغلق بدليل حيّ أو يبقى `pending T09/T10`. T10 مراجعة مستقلة لم تجرِ.

<!-- GRAPHQL-OPS:BEGIN -->
## GraphQL — Query (263)

| العملية | النوع | الدور | النطاق | مصدر النطاق | الحراس | الصلاحية | الملكية | قيد الخدمة | إثبات |
|---|---|---|---|---|---|---|---|---|---|
| `abandonedCartIds` | Query | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `abandonedCartOps` | Query | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops|manage_own_shop | — | public / no tenant write | pending T09/T10 |
| `abandonedCartStatusCounts` | Query | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `abandonedCarts` | Query | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `abandonedCartsByProduct` | Query | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `abandonedCartsSummary` | Query | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `abusiveReports` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `activityLog` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `activityLogs` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `adSpends` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, ShopOwnershipGuard | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `address` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | customer_id = JWT user.id | live customer A cannot read B |
| `adminShopDomains` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `aiContentHourlyAllowance` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `aiImageGeneration` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `aiImageGenerations` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `aiRecommendations` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, GqlThrottlerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `aiSearch` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, GqlThrottlerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `aiSpendByPlan` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `aiSpendByShop` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `allPlans` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `analytics` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `attachment` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `attachmentUsage` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `attachments` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `attribute` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `attributes` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `attributionReport` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, ShopOwnershipGuard | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `auditAnomalies` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `author` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manag | header | header shop; service may re-check | pending T09/T10 |
| `authors` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `balanceTransactions` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops | header | owned shops; swapped X-SHOP forbidden | live no B shop_id rows |
| `bankTransfer` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | manage_own_orders|manage_all_orders | header | canView: customer or shop owner | pending T09/T10 |
| `bankTransfers` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, ShopOwnershipGuard, | manage_own_orders|manage_all_orders|manage_own_orders|manage_all_orders | ShopOwnershipGuard | ShopOwnershipGuard + queue(shop.id, owner) | live owner A X-SHOP=B |
| `banks` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `banner` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_sho | header | header shop; service may re-check | pending T09/T10 |
| `banners` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `becameSellerRequests` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `cart` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `categoryAttributes` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `categorySales` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `cities` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `collection` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `collectionItems` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `collections` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `commission` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `commissions` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `contact` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manag | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `contacts` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `coupon` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `couponPerformance` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `couponStats` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `coupons` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `customerAnalytics` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, ShopOwnershipGuard | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `customerSegment` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `customerSegmentFilters` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `customerSegments` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_ow | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `defaultShopPackage` | Query | public | public | none | — | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `deliveryTime` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `deliveryTimes` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `describeCustomerSegment` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `directConversation` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `directConversations` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `dispute` | Query | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `disputes` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `domainRequest` | Query | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `draftOrder` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders|manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `draftOrders` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders|manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `enhancePresets` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `enhanceRun` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `enhanceRuns` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `enhanceStyles` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `explainCustomerSegment` | Query | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard, GqlThrottlerGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `faq` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_ | header | header shop; service may re-check | live FAQ A/B + soft-delete |
| `faqs` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | live FAQ A/B |
| `featureCatalog` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `flashSale` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `flashSales` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `inWishlist` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `insights` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, ShopOwnershipGuard | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `integrationConfigs` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `integrationProviders` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `integrationStatus` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `inventoryAnalytics` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, ShopOwnershipGuard | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `inventoryHistory` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `inventoryItems` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `inventoryLevels` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `inventoryLocations` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `inventoryTransfer` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `inventoryTransferStats` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `inventoryTransferTimeline` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `inventoryTransfers` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `isShopSlugAvailable` | Query | public | public | none | OptionalJwtGuard | — | — | public / no tenant write | pending T09/T10 |
| `language` | Query | admin | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_all_shops|manage_all_shops | header | exclusive admin permission; audit where mutation | pending T09/T10 |
| `languages` | Query | admin | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_all_shops | header | exclusive admin permission; audit where mutation | live REST CurrentShop.id |
| `lookupNationalAddress` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard, GqlThrottlerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `lookups` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | live REST CurrentShop.id |
| `lowStockProducts` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `manufacturer` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `manufacturers` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `me` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `menu` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `menus` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `myAddresses` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `myAiSpenders` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `myCustomerProfile` | Query | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `myDigitalFiles` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `myEntitlements` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | ShopOwnershipGuard; CurrentShop.id | pending T09/T10 |
| `myInvoices` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | ShopOwnershipGuard; Stripe invoices for CurrentShop.id only | live owner A X-SHOP=B; missing header; customer; limited admin |
| `myPaymentMethods` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `myPlan` | Query | public | public | none | OptionalJwtGuard | — | — | ShopOwnershipGuard; CurrentShop.id | pending T09/T10 |
| `myShopTelegramBot` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `myShops` | Query | public | public | none | OptionalJwtGuard | — | — | public / no tenant write | pending T09/T10 |
| `myShortLinks` | Query | public | public | none | OptionalJwtGuard | — | — | public / no tenant write | pending T09/T10 |
| `myTelegramBot` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `myTelegramOrderUpdates` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `myUsage` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | ShopOwnershipGuard; CurrentShop.id | pending T09/T10 |
| `myUsageEvents` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | ShopOwnershipGuard; cost_cents stripped | pending T09/T10 |
| `myUsageSummary` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | ShopOwnershipGuard; cost_cents stripped | pending T09/T10 |
| `myVendorBot` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `myWallet` | Query | admin | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | manage_all_orders | header | exclusive admin permission; audit where mutation | pending T09/T10 |
| `myWhatsAppInstance` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `negotiationAvailable` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `negotiationOutcomeRollups` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `negotiationOutcomes` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `negotiationPolicies` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `negotiationSession` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `notificationCatalog` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `notificationPreferences` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `notificationSetting` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `notificationTemplate` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `notifications` | Query | user | user | JWT user.id / resource id | JwtAuthGuard, GqlThrottlerGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `order` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | auth filter at query; includeOwnPurchases | pending T09/T10 |
| `orderBankTransfers` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | order customer_id or shop owner | pending T09/T10 |
| `orderByTrackingNumber` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `orderShippingEconomics` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_orders|manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `orders` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | buildAuthFilter; swapped X-SHOP forbidden for vendor | live no B order id; count unchanged |
| `ordersByStatus` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `otpDeliveryErrorGroups` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `otpLogs` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `otpSettings` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `pageBySlug` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `pages` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_s | header | header shop; service may re-check | pending T09/T10 |
| `payLinkOrder` | Query | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `paymentGatewayFees` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `paymentIntents` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `pendingStockNotifications` | Query | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | live no B email leak |
| `planComparison` | Query | public | public | none | OptionalJwtGuard | — | — | public / no tenant write | pending T09/T10 |
| `planEntitlements` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `plans` | Query | admin | platform | platform | OptionalJwtGuard | manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `platformShippingHealth` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `platformWhatsApp` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `previewCollection` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `previewCustomerSegment` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `previewNegotiationFloor` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `previewPlanChange` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | ShopOwnershipGuard | pending T09/T10 |
| `product` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `productCategories` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `productNegotiationStatuses` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `productOrganizationOptions` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `productRelations` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `products` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `publicVendorAgentConversationByToken` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `purchaseOrder` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `purchaseOrders` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `questions` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `referralEarnings` | Query | admin | platform | platform | JwtAuthGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `refund` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | owned shop or customer_id | pending T09/T10 |
| `refundPolicies` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop | header | header shop; service may re-check | P02-T05 |
| `refundPolicy` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `refunds` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | owned shops; swapped X-SHOP forbidden | live no B refund id; status unchanged |
| `reportSchema` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, ShopOwnershipGuard | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `return` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `returns` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `review` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `reviews` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `rolePermission` | Query | admin | platform | platform | JwtAuthGuard | manage_role_permissions|manage_role_permissions|manage_role_permissions | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `rolePermissions` | Query | admin | platform | platform | JwtAuthGuard | manage_role_permissions|manage_role_permissions | — | exclusive admin permission; audit where mutation | live limited admin denied |
| `runReport` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `runSavedReport` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `salesByChannel` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `salesReport` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `savedPrompt` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | live owner B cannot read A |
| `savedPrompts` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `savedReports` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `segmentInsights` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `segmentTemplates` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `sellThroughProducts` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `setting` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `settings` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `shipment` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `shipments` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | owned shops; swapped X-SHOP forbidden | live owner A X-SHOP=B |
| `shippingProviderAccounts` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shippingProviderCatalog` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shippingProviderLocations` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shippingRule` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `shippingRules` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_s | header | header shop; service may re-check | pending T09/T10 |
| `shippingZones` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `shop` | Query | public | public | none | OptionalJwtGuard | — | — | public / no tenant write | pending T09/T10 |
| `shopBankAccounts` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | manage_own_shop|manage_all_shops | header | CurrentShop.id; include_inactive requires owner | pending T09/T10 |
| `shopByHostname` | Query | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `shopCustomers` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shopDomainConfiguration` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `shopDomains` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shopOverrides` | Query | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_plans|manage_pl | — | JWT subject; resource ownership in service | pending T09/T10 |
| `shopPackages` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, PermissionsGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shopPaymentOptions` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `shopPaymentSettings` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | ShopOwnershipGuard + assertOwnShop | live owner A X-SHOP=B; customer |
| `shopReviews` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shopReviewsSummary` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shopShippingCarriers` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shopShippingSettings` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shopSubscriptions` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `shopWhatsAppThread` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shopWhatsAppThreads` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shops` | Query | public | public | none | OptionalJwtGuard | — | — | public / no tenant write | pending T09/T10 |
| `shortLink` | Query | public | public | none | OptionalJwtGuard | — | — | public / no tenant write | pending T09/T10 |
| `staffNotificationRecipients` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `storageUsage` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `storeImportJob` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `storeImportJobs` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `storeImportMediaIssues` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, // After ShopHeaderGuard: it reads the shop that guard resolved. ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `storeImportPreview` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `storeImportProducts` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `storeNotice` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard | manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `storeNotices` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `storefrontProduct` | Query | public | shop | CurrentShop.id | ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `storefrontProductRelations` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `storefrontProducts` | Query | public | shop | CurrentShop.id | ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `storefrontRecommendations` | Query | public | shop | CurrentShop.id | ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `supplier` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `suppliers` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `systemCategoriesFlat` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `systemCategory` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `systemCategoryTree` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `tag` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `tags` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|ma | header | header shop; service may re-check | pending T09/T10 |
| `target` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `targets` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `tax` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `taxClasses` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `taxes` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_ow | header | header shop; service may re-check | pending T09/T10 |
| `termsAndCondition` | Query | admin | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_all_shops|manage_all_shops | header | exclusive admin permission; audit where mutation | pending T09/T10 |
| `termsAndConditions` | Query | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `topProducts` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `usageLedger` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `usageSummary` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `usageTopShops` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `user` | Query | admin | platform | platform | JwtAuthGuard | manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `users` | Query | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `vendorAgentArchivedConversations` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `vendorAgentBriefing` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `vendorAgentConversation` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `vendorAgentConversations` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `vendorAgentWeeklyInsights` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `vendorSignupEmailAvailable` | Query | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `vendorSignupSlugAvailable` | Query | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `verifyDownloadToken` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `webhookDeliveries` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `webhookSubscriptions` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `wishlists` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `withdrawal` | Query | user | user | JWT user.id / resource id | JwtAuthGuard | manage_own_shop|manage_all_shops | — | user_id match unless admin | live owner A cannot read B |
| `withdrawals` | Query | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard | — | header | user_id + owned shop; swapped X-SHOP forbidden | live no B id leak |
| `yearlySales` | Query | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |

## GraphQL — Mutation (402)

| العملية | النوع | الدور | النطاق | مصدر النطاق | الحراس | الصلاحية | الملكية | قيد الخدمة | إثبات |
|---|---|---|---|---|---|---|---|---|---|
| `acceptNegotiation` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, GqlThrottlerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `addInventoryTransferComment` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `addNegotiatedOfferToCart` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `addProductRelation` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `addStaffNotificationRecipient` | Mutation | public | public | none | — | manage_own_shop | — | public / no tenant write | pending T09/T10 |
| `addToCart` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | live mixed-shop cart |
| `amount_cents` | Mutation | unclassified | — | — | — | — | — | unclassified — pending T10 | pending T09/T10 |
| `customer_id` | Mutation | unclassified | — | — | — | — | — | unclassified — pending T10 | pending T09/T10 |
| `note` | Mutation | unclassified | — | — | — | — | — | unclassified — pending T10 | pending T09/T10 |
| `adjustInventory` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `adminCreateShop` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `adminUpdateUser` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `aiEditorTransform` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, GqlThrottlerGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `answerQuestion` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | live row unchanged |
| `applyCartCoupon` | Mutation | public | shop | CurrentShop.id | GqlThrottlerGuard, OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `approveBecameSeller` | Mutation | admin | platform | platform | JwtAuthGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `approveShop` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|approve_shop|approve_shop | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `askShopAssistant` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, GqlThrottlerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `assignShopPlan` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `attachProductToCollection` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `backfillProductEnrichment` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `blockCustomerFromAi` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `bulkDeleteCustomerSegments` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `bulkDeleteVendorAgentConversations` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `bulkFillStoreImportOverrides` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `bulkPinVendorAgentConversations` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `bulkUpdateProductsPrice` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `bulkUpdateProductsStatus` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `bulkUpdateProductsTags` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `bulkUpsertNegotiationPolicies` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `cancelImageGeneration` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `cancelInventoryTransfer` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `cancelMySubscription` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | ShopOwnershipGuard | pending T09/T10 |
| `cancelOrder` | Mutation | admin | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_all_orders|manage_all_orders | header | exclusive admin permission; audit where mutation | pending T09/T10 |
| `cancelShipment` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop|manage_all_orders | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `cancelShopSubscription` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `cancelStoreImport` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `carryStoreImportOverrides` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `changePassword` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `changePlanSubscription` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | ShopOwnershipGuard | pending T09/T10 |
| `clearCart` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `clearPrimaryShopDomain` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `closePurchaseOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `commitStoreImport` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `completeVendorSignup` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `confirmPayment` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_all_orders|manage_own_refunds|manage_all_refu | — | JWT subject; resource ownership in service | pending T09/T10 |
| `confirmReferralEarning` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `connectPlatformWhatsApp` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `connectShopDomain` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `connectShopTelegramBot` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `connectTelegramBot` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `connectTelegramOrderUpdates` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `connectWhatsApp` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `convertDraftOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders|manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `createAbusiveReport` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createAdSpend` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `createAddress` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | customer_id = JWT user.id | pending T09/T10 |
| `createAttribute` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `createAttributeDefinition` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createAttributeOption` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createAuthor` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_o | header | header shop; service may re-check | pending T09/T10 |
| `createBanner` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_ | header | header shop; service may re-check | pending T09/T10 |
| `createCollection` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createCommission` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createContact` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|m | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createCoupon` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createCustomerSegment` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | CSV sibling |
| `createDeliveryTime` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createDigitalFile` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createDraftOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders|manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `createFaq` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | live owner A X-SHOP=B write |
| `createFlashSale` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `createInventoryLocation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createInventoryTransfer` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createLanguage` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createManufacturer` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `createMenu` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|man | header | header shop; service may re-check | pending T09/T10 |
| `createOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard, GqlThrottlerGuard, | manage_own_orders|manage_all_orders | header | product.shop_id must equal CurrentShop.id | live CROSS_SHOP_PRODUCT |
| `createPage` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|man | header | header shop; service may re-check | pending T09/T10 |
| `createPaymentIntent` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `createPaymentLink` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `createPlan` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createProduct` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_sho | header | header shop; service may re-check | pending T09/T10 |
| `createPurchaseOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createQuestion` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `createReferralEarning` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createRefund` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | manage_own_refunds|manage_all_refunds | header | header shop; service may re-check | pending T09/T10 |
| `createRefundPolicy` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_own_shop|mana | header | header shop; service may re-check | pending T09/T10 |
| `createReturn` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | manage_own_refunds|manage_all_refunds | header | header shop; service may re-check | pending T09/T10 |
| `createReview` | Mutation | admin | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createSavedPrompt` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | P02-T05 + live |
| `createSavedReport` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `createShipment` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createShippingRule` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `createShippingZone` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `createShop` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `createShopBankAccount` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | ShopOwnershipGuard; shop_id = CurrentShop.id | live fixture B; A on B refused via sibling writes |
| `createShopPackage` | Mutation | public | public | none | — | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|manage_a | — | public / no tenant write | pending T09/T10 |
| `createShortLink` | Mutation | public | public | none | OptionalJwtGuard | — | — | public / no tenant write | pending T09/T10 |
| `createStoreImport` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, // After ShopHeaderGuard: it reads the shop that guard resolved. ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createStoreNotice` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createSupplier` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createTag` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `createTarget` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `createTax` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|m | header | header shop; service may re-check | pending T09/T10 |
| `createTaxClass` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createTermsAndConditions` | Mutation | admin | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard | manage_all_shops|manage_all_shops|manage_all_shops | header | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createUser` | Mutation | admin | platform | platform | JwtAuthGuard | manage_users|manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `createWebhookSubscription` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|man | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `createWithdrawal` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_all_orders | ShopOwnershipGuard | ShopOwnershipGuard + owner_id in tx (D26 frozen) | pending T09/T10 |
| `amount_cents` | Mutation | unclassified | — | — | — | — | — | unclassified — pending T10 | pending T09/T10 |
| `customer_id` | Mutation | unclassified | — | — | — | — | — | unclassified — pending T10 | pending T09/T10 |
| `deleteAdSpend` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `deleteAddress` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `deleteAttachment` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteAttachments` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteAttribute` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteAttributeDefinition` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteAttributeOption` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteAuthor` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteBanner` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteCollection` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteCommission` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteContact` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteCoupon` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteCustomerSegment` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteDeliveryTime` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_own_shop | header | header shop; service may re-check | pending T09/T10 |
| `deleteDigitalFile` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteDraftOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `deleteEnhancePreset` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteFaq` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteFlashSale` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteIntegration` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteInventoryLocation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteInventoryTransfer` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteLanguage` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteManufacturer` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteMenu` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteNotification` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteOrder` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_orders | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deletePage` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deletePaymentMethod` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `deletePlan` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans|manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteProduct` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deletePurchaseOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteRefundPolicy` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteReview` | Mutation | admin | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_all_shops | header | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteSavedPrompt` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | P02-T05 |
| `deleteSavedReport` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `deleteShippingProviderAccount` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteShippingRule` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `deleteShippingZone` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `deleteShop` | Mutation | admin | platform | platform | JwtAuthGuard | manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteShopBankAccount` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | ShopOwnershipGuard + ownedAccount + shop_id match | live deleted_at stays null |
| `deleteShopPackage` | Mutation | public | public | none | — | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `deleteStoreNotice` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteSupplier` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteTag` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `deleteTarget` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `deleteTax` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `deleteTaxClass` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteTermsAndConditions` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteUser` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `deleteVendorAgentConversation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteWebhookSubscription` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `deleteWithdrawal` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_orders | — | MANAGE_ALL_ORDERS exclusive; audited | pending T09/T10 |
| `detachProductFromCollection` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `disapproveShop` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | approve_shop|approve_shop | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `disconnectPlatformWhatsApp` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `disconnectShopTelegramBot` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `disconnectTelegramBot` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `disconnectWhatsApp` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `dismissInsight` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `duplicateInventoryTransfer` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `duplicateProduct` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `editInventoryStock` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `editOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders|manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `enableCarrierPickup` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `endCustomerSession` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `enhanceImage` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `enhanceImageShots` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `exportOrdersCsv` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, GqlThrottlerGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `exportProductsCsv` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `forgetPassword` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `fulfillOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `generateCustomerSegmentFromPrompt` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard, GqlThrottlerGuard | manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `generateDownloadLink` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `generateProductImage` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `hideAbandonedCart` | Mutation | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manag | — | public / no tenant write | pending T09/T10 |
| `hideAbandonedCarts` | Mutation | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `importProductsCsv` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `login` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `logout` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `manageReceivedItems` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `mapShippingProviderLocation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `markAllNotificationsRead` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `markConversationRead` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `markInsightRead` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `markNotificationRead` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `markNotificationUnread` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `markReferralEarningPaid` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `markStoreNoticeAsRead` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, ShopOwnershipGuard, | manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `markTransferReadyToShip` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `markTransferTransferred` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `markWhatsAppThreadRead` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `notificationStreamTicket` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, GqlThrottlerGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `openBillingPortal` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | ShopOwnershipGuard; Stripe portal for CurrentShop.id | pending T09/T10 |
| `openOrderPayment` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `orderPurchaseOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `pinVendorAgentConversation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `platformWhatsAppQrTicket` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `previewNotificationTemplate` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `receiveInventoryTransfer` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `receivePurchaseOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_ | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `recomputePredictedSpendTiers` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `reconcileCustomerContacts` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `reconcileShopSubscription` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `recordAbandonedCartDraft` | Mutation | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `recordCartLinkOpen` | Mutation | public | shop | CurrentShop.id | GqlThrottlerGuard, OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `refreshCustomerSession` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `refreshShipmentTracking` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `refreshToken` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `refundUnappliedPayment` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_refunds|manage_all_refunds | header | header shop; service may re-check | pending T09/T10 |
| `register` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `rejectBecameSeller` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `removeCartCoupon` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `removeCartItem` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `removeProductRelation` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `removeShopDomain` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `removeStaffNotificationRecipient` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `renameAttachment` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `renameVendorAgentConversation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_o | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `renewShopSubscription` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `reorderCollectionProducts` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `reorderProductRelation` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `replaceAttachmentFromExisting` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `replyToWhatsAppThread` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `requestBecameSeller` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `requestMagicLink` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `requestWhatsAppPairingCode` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `resendSenderVerification` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `resendVendorSignupOtp` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `resendVerificationEmail` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `resetPassword` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `resetShopShippingCarriers` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `resetShopUsage` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `restoreShops` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|approve_shop|approve_shop | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `restoreUsers` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `restoreVendorAgentConversation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `resumeMySubscription` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | ShopOwnershipGuard | pending T09/T10 |
| `resumeWhatsAppAssistant` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `retryStoreImportMedia` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `revealOtpCode` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `revertNotificationTemplate` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `reviewBankTransfer` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_orders|manage_all_orders | — | canReview shop owner, not the customer | pending T09/T10 |
| `revokeVendorAgentConversationShare` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `rotateWebhookSecret` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `saveEnhancePreset` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `saveIntegration` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `savePaymentMethod` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `saveStoreImportOverrides` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `selectAiImageResults` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `sendAbandonedCartReminder` | Mutation | public | public | none | ...vendorListGuards, FeatureGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `sendContactMessage` | Mutation | public | shop | CurrentShop.id | GqlThrottlerGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `sendCustomerSignInCode` | Mutation | public | shop | CurrentShop.id | GqlThrottlerGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `sendDirectMessage` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `sendIntegrationTest` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `sendInventoryTransfer` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `sendNegotiationMessage` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, GqlThrottlerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `sendOtpCode` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `sendTestNotification` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `sendTestStaffNotification` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `sendTestWebhook` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `sendWhatsAppTest` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setDefaultPaymentMethod` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `setDefaultShopPackage` | Mutation | public | public | none | — | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `setDefaultTaxClass` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setIntegrationEnabled` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `setInventoryAvailable` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setNegotiationExcludedOptions` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setNegotiationOptionFloors` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setPlanEntitlements` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `setPrimaryShopDomain` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `setSenderEmail` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setShipmentActualCost` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setShippingProviderAccountEnabled` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setShopShippingCarriers` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setShopTelegramCustomerBot` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `setShopTelegramCustomerBotOrders` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `setShopsActive` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `setSubscriptionOverride` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans|manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `setUsersActive` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `setWhatsAppCustomerBot` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `setWhatsAppCustomerBotOrders` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `shareVendorAgentConversation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `signInWithSocial` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `skipStoreImportMedia` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `startNegotiation` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, GqlThrottlerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `startPlanCheckout` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | ShopOwnershipGuard; shop charged is header, not input | live no Stripe URL for A on B |
| `startVendorSignup` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `subscribeNewsletter` | Mutation | public | shop | CurrentShop.id | GqlThrottlerGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | P02-T07 CurrentShop.id |
| `subscribeStockNotification` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, OptionalShopCustomerGuard, GqlThrottlerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `suggestAttachmentAlt` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | — | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `suggestProductAttributes` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `suggestSystemCategories` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `syncCarrierPickup` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `syncCart` | Mutation | shop | shop | CurrentShop.id | GqlThrottlerGuard, JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `syncMySubscription` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | ShopOwnershipGuard | pending T09/T10 |
| `syncPlatformWhatsAppWebhook` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `syncShopTelegramWebhook` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `syncWhatsAppWebhooks` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `toggleFeedback` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `toggleWishlist` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `transferInventory` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `triggerEmbedding` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `unblockCustomerFromAi` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `unhideAbandonedCart` | Mutation | public | public | none | ...vendorListGuards | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `unlinkVendorBot` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `unlockSharedVendorAgentConversation` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `unmapShippingProviderLocation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `unsubscribeStockNotification` | Mutation | public | public | none | GqlThrottlerGuard | manage_own_shop|manage_all_shops | — | public / no tenant write | pending T09/T10 |
| `updateAdSpend` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `updateAddress` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `updateAttachment` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `updateAttribute` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `updateAttributeDefinition` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updateAttributeOption` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updateAuthor` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updateBanner` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updateCartItem` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `updateCollection` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateCommission` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updateContact` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updateCoupon` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateCustomerSegment` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateDeliveryChannels` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateDeliveryTime` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateDraftOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders|manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `updateFaq` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | live id of B from A; soft-delete |
| `updateFlashSale` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateInventoryLocation` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateInventoryTransfer` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateLanguage` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updateManufacturer` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `updateMenu` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updateMyCustomerProfile` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `updateNotificationPreference` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `updateNotificationSetting` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateNotificationTemplate` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_orders|manage_all_orders|manage_own_orders|manage_all_orders | header | header shop; service may re-check | pending T09/T10 |
| `updateOtpSettings` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations|manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updatePage` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updatePlan` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_plans|manage_plans|manage_plans|manage_plans | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updateProduct` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard, PermissionsGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | — | JWT subject; resource ownership in service | pending T09/T10 |
| `updatePurchaseOrder` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateRefundPolicy` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | live slug unchanged |
| `updateRefundStatus` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_refunds|manage_all_refunds | header | header shop; service may re-check | pending T09/T10 |
| `updateReturnStatus` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_own_refunds|manage_all_refunds | header | header shop; service may re-check | pending T09/T10 |
| `updateReview` | Mutation | admin | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, RequireShopGuard, ShopCustomerGuard | manage_all_shops | header | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updateRolePermissions` | Mutation | admin | platform | platform | JwtAuthGuard | manage_role_permissions|manage_role_permissions | — | exclusive admin permission; audit where mutation | P02-T08 + live |
| `updateSavedPrompt` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | P02-T05 |
| `updateSavedReport` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `updateShipmentStatus` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateShippingRule` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updateShippingZone` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updateShop` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | — | — | JWT subject; resource ownership in service | pending T09/T10 |
| `updateShopBankAccount` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | ShopOwnershipGuard + ownedAccount + shop_id match | live notes on B unchanged |
| `updateShopPackage` | Mutation | public | public | none | — | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop | — | public / no tenant write | pending T09/T10 |
| `updateShopPaymentSettings` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | ShopOwnershipGuard + assertOwnShop | live flags on B unchanged |
| `updateShopShippingMode` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateStaffNotificationRecipient` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `updateSupplier` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateTag` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard | manage_all_shops|manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updateTarget` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `updateTax` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `updateTaxClass` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateTermsAndConditions` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updateUser` | Mutation | admin | platform | platform | JwtAuthGuard | manage_users|manage_users | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `updateWebhookSubscription` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `updateWithdrawalStatus` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_orders|manage_all_orders | — | MANAGE_ALL_ORDERS exclusive; audited | pending T09/T10 |
| `upsertNegotiationPolicy` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, FeatureGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `upsertPaymentGatewayFee` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_all_shops|manage_all_shops | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `upsertSetting` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `upsertShippingProviderAccount` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `vendorAgentChat` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, GqlThrottlerGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `vendorAgentSaveReceipt` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `verifyCheckout` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `verifyCoupon` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, GqlThrottlerGuard, ShopHeaderGuard, RequireShopGuard, OptionalShopCustomerGuard, | — | header | header shop; service may re-check | pending T09/T10 |
| `verifyCustomerSignInCode` | Mutation | public | shop | CurrentShop.id | GqlThrottlerGuard, ShopHeaderGuard, RequireShopGuard | — | header | header shop; service may re-check | pending T09/T10 |
| `verifyEmail` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `verifyForgetPasswordToken` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `verifyIntegration` | Mutation | admin | platform | platform | JwtAuthGuard, PermissionsGuard | manage_integrations | — | exclusive admin permission; audit where mutation | pending T09/T10 |
| `verifyMagicLink` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `verifyOtpCode` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `verifyPayment` | Mutation | admin | shop | CurrentShop.id | JwtAuthGuard, ShopHeaderGuard, OptionalShopCustomerGuard | manage_all_orders | header | exclusive admin permission; audit where mutation | pending T09/T10 |
| `verifySender` | Mutation | user | user | JWT user.id / resource id | JwtAuthGuard | manage_own_shop | — | JWT subject; resource ownership in service | pending T09/T10 |
| `verifyShippingProviderAccount` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_all_shops|manage_own_shop|manage_all_shops | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `verifyShopDomain` | Mutation | public | public | none | — | — | — | public / no tenant write | pending T09/T10 |
| `verifyVendorSignupOtp` | Mutation | public | public | none | GqlThrottlerGuard | — | — | public / no tenant write | pending T09/T10 |
| `viewProduct` | Mutation | public | shop | CurrentShop.id | OptionalJwtGuard, GqlThrottlerGuard, ShopHeaderGuard | manage_own_shop|manage_all_shops | header | header shop; service may re-check | pending T09/T10 |
| `whatsAppInboxTicket` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |
| `whatsAppQrTicket` | Mutation | shop | shop | CurrentShop.id | JwtAuthGuard, PermissionsGuard, ShopHeaderGuard, RequireShopGuard, ShopOwnershipGuard, | manage_own_shop|manage_own_shop | ShopOwnershipGuard | owner_id === caller; CurrentShop.id | pending T09/T10 |

Unclassified Query: 0; Mutation: 5. Resolver-mapped: 662.
<!-- GRAPHQL-OPS:END -->

## وظائف الخلفية (BullMQ) — P02-T06

لا يستقبل أي معالج `shop_id` من العميل. الطابور الداخلي فقط. الصف يحمل معرّف صف أُنشئ بعد الحراس، أو المعرّف يأتي من `findMany` على المتاجر في مُجدوِل.

| الطابور / المهمة | مصدر المتجر | من يُصفّ؟ |
|---|---|---|
| `store-import` (`SCAN` / `COMMIT` / `TRANSFER`) | `jobId` → `StoreImportJob.shop_id` كُتب عند الإدراج من `CurrentShop` | لا |
| `image-gen` | `generationId` → صف التوليد | لا |
| `webhooks` `DELIVER_WEBHOOK` | `deliveryId` → الاشتراك | لا |
| `insights` `ANALYZE_SHOP_INSIGHTS` | `shopId` من `shop.findMany` في المُجدوِل | لا (cron) |
| `sales-rollup` `REFRESH_SALES_ROLLUP` | كذلك | لا (cron) |
| بريد / إشعارات / واتساب / تيليغرام | صف الطلب أو الجلسة أو الويب هوك الموقّع | لا |

تنزيل الملف الرقمي عبر REST `/api/downloads/:token` غير منفّذ؛ التوكن GraphQL يتحقق من الشراء. خارج الإصدار (D12).

## قواعد قراءة هذا الملف

- `X-SHOP` الخام (slug) ليس معرّف صف. الخدمة يجب أن تستلم `CurrentShop.id` بعد `ShopHeaderGuard`.
- `PermissionsGuard` يقرأ `getAllAndOverride` (الدالة ثم الصنف): metadata الدالة **تستبدل** شرط الصنف إن وُجدت، وإلا يُستخدم الصنف. المطابقة `.some()`. عملية إدارية حقاً تُغلق بصلاحية إدارة وحدها، لا مع `manage_own_shop`.
- صف `webhook` يُغلق بتوقيع أو سر الصف، لا بـJWT.
- مراجعة مستقلة للخدمات (T10) لم تجرِ من منفّذ هذا الجرد. منفّذ T01–T09 لا يستطيع صدق `[x]` على «مراجع مستقل».

## مخاطر متبقية (مرور ثانٍ من المنفّذ، ليست مراجعة مستقلة)

| البند | الحالة |
|---|---|
| `reviewBankTransfer` بلا `ShopOwnershipGuard` | الخدمة `assertReviewer` على `shop.owner_id`؛ إثبات حيّ 2026-09-16 |
| `shopBankAccounts` بلا ملكية للمتجر | مقصود: checkout يقرأ IBAN النشط لنفس `X-SHOP` |
| `banks` في الجدول المولَّد | المصنّف قد يضع حراساً خاطئة؛ المصدر بلا حارس وهو كتالوج عام |
| معظم صفوف GraphQL `pending T09/T10` | الإثبات الحيّ للأسطح عالية الأثر + الفوترة، لا لكل عملية |
| P01 تدوير الأسرار / T10/T11 | وكيل شقيق؛ لا يُغلق P02 على نتيجته |
| إدارة بلا ترويسة (`shop_scope_bypass`) | مسجّل؛ يحتاج مراجعاً مستقلاً يقرأ مسار التدقيق |
