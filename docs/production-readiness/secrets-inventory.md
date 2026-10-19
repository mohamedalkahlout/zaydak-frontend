# جرد أسماء الأسرار (بدون قيم)

**المرحلة:** P01-T07 / P01-T08 (جرد الجداول المشفّرة)  
**التاريخ:** 2026-09-16  
**القاعدة:** هذا الملف أسماء ومواقع وملاك فقط. لا قيم، لا مقتطفات اتصال، لا مفاتيح.

المصادر: ملفات `.env.example` المتتبَّعة، و`SecretCryptoService`، و`SecretRotationService`، وقائمة الإطلاق القديمة للتعرض التاريخي. تواريخ الإلغاء عند المزود **غير مؤكدة محلياً** ما لم يُذكر دليل تشغيل.

المالك التشغيلي الافتراضي: مسؤول التشغيل (Render / Vercel / Neon / Upstash). المالك التقني: مسؤول الواجهة الخلفية والأمن.

## مفاتيح البيئة — الواجهة الخلفية

| الاسم | أين يُستخدم | المالك | إلغاء عند المزود |
|---|---|---|---|
| `DATABASE_URL` | Prisma / Postgres (المجمّع في الإنتاج) | تشغيل + بيانات | غير مؤكد؛ تعرض تاريخي في git — راجع [go-live-checklist](../go-live-checklist.md) |
| `MIGRATE_DATABASE_URL` | ترحيلات Prisma على المضيف المباشر | تشغيل + بيانات | اختياري؛ فارغ يستخدم اشتقاق المضيف غير المجمّع |
| `REDIS_URL` أو `REDIS_HOST` / `REDIS_PASSWORD` | طوابير، كاش، محدد معدل، إبطال access token | تشغيل | غير مؤكد |
| `JWT_SECRET` | توقيع رموز الوصول | أمن + تشغيل | غير مؤكد؛ تدويره يبطل الجلسات الحية |
| `APP_SECRET` | HMAC (روابط سحرية وغيرها) ومفتاح تشفير احتياطي | أمن + تشغيل | دُوِّر محلياً 2026-09-16؛ إنتاج Render غير مؤكد |
| `SECRETS_ENCRYPTION_KEY` | AES-256-GCM لكل ظرف في قاعدة البيانات | أمن + تشغيل | دُوِّر محلياً 2026-09-16 (انظر سجل التدوير)؛ إنتاج غير مؤكد |
| `SECRETS_ENCRYPTION_KEY_PREVIOUS` | نافذة قراءة المفتاح القديم أثناء التدوير | أمن + تشغيل | أُزيل من بيئة `zaydak` بعد `failed=0` و`rotated=0`؛ مسار الكود باقٍ |
| `STRIPE_API_KEY` | Stripe Checkout / webhooks الصادرة | مالية + تشغيل | غير مؤكد |
| `STRIPE_WEBHOOK_SECRET` | التحقق من `POST /webhooks/stripe` | مالية + تشغيل | غير مؤكد |
| `BUNNYCDN_API_KEY` | تخزين الملفات | تشغيل | غير مؤكد؛ تعرض تاريخي في git |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | مخزن إيصالات اختياري | تشغيل | فارغ افتراضياً |
| `STOREFRONT_REVALIDATE_SECRET` | تطهير كاش المتجر؛ يطابق `REVALIDATE_SECRET` | تشغيل | يُولَّد محلياً؛ ليس عند مزود |
| `VERCEL_TOKEN` | إصدار شهادات نطاق التاجر (اختياري) | تشغيل | صلاحية على مشروع Vercel كامل |
| `SLACK_WEBHOOK_URL` | محوّل التنبيهات | تشغيل | فارغ = سجلّ الكونسول |
| `SENTRY_DSN` | إقلاع SDK قبل Nest؛ احتياطي لوحة التكاملات | مراقبة | DSN عام للمشروع؛ التدوير عند Sentry |
| `GEMINI_API_KEY` | احتياطي بيئي لتوليد الصور | ذكاء اصطناعي | يُفضَّل صف `AI_MEDIA` في الكونسول |
| `SCRAPINGBEE_API_KEY` | احتياطي بيئي لاستيراد المتجر | تكاملات | يُفضَّل صف `SCRAPING` في الكونسول |
| `AI_SERVICE_KEY` | عميل خدمة بايثون غير الموجودة (D14) | ذكاء اصطناعي | خارج النطاق؛ لا يُعتمد عليه |
| `SEED_*_PASSWORD` | بذور التطوير فقط | تشغيل | ممنوعة في الإنتاج بلا `ALLOW_PROD_SEED` |

احتياطيات المزود التي كانت في البيئة وانتقلت إلى الكونسول (SMS، البريد، واتساب Evolution، تيليجرام المنصة، المراقبة، الشحن، الاستخراج) تُدار كصفوف مشفّرة أدناه. قيم `.env` تبقى احتياطاً إذا لم يُفعَّل صف.

## مفاتيح البيئة — الواجهات

| الاسم | التطبيق | المالك | ملاحظات |
|---|---|---|---|
| `NEXT_PUBLIC_GRAPHQL_URL` | الثلاثة | تشغيل | ليس سراً |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | vendor، storefront | مراقبة | SDK يتوقف بلا DSN؛ لا قيمة مضمّنة |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | بناء vendor وstorefront | مراقبة | التوكن لا يُشحن للمتصفح |
| `REVALIDATE_SECRET` | storefront | تشغيل | يطابق `STOREFRONT_REVALIDATE_SECRET` |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_STOREFRONT_URL` / `NEXT_PUBLIC_ROOT_DOMAIN` | حسب التطبيق | تشغيل | ليست أسراراً |

لوحة الإدارة لا تحمل حالياً كتلة Sentry في `.env.example`.

## أسرار مخزّنة مشفّرة (AES-256-GCM)

الظرف: `v1.<iv>.<tag>.<ciphertext>`. المفتاح من `SECRETS_ENCRYPTION_KEY` (أو `APP_SECRET` إن غاب). **`SecretRotationService` يعيد تشفير كل الصفوف التالية عند الإقلاع إذا وُجد `SECRETS_ENCRYPTION_KEY_PREVIOUS`.**

| الجدول.العمود | AAD | من يكتب | الاسترداد إن فشل الفك |
|---|---|---|---|
| `integration_configs.credentials` | `integration:<type>` | لوحة الإدارة | إعادة إدخال المزود |
| `shipping_provider_accounts.credentials` | `shipping_provider_account:<id>` | إعدادات شحن التاجر | إعادة إدخال حساب الناقل |
| `shop_whatsapp_instances.webhook_secret` | معرّف الصف | pairing المتجر | إعادة الربط (سر جديد) |
| `platform_whatsapp_instances.webhook_secret` | معرّف الصف | pairing المنصة | إعادة الربط |
| `shop_telegram_bots.bot_token` | معرّف الصف | لصق توكن BotFather | إعادة لصق التوكن |
| `shop_telegram_bots.webhook_secret` | معرّف الصف | connect المتجر | إعادة `setWebhook` |
| `platform_telegram_bots.webhook_secret` | معرّف الصف | ربط مساعد المنصة | قبل الصف: اشتقاق من `APP_SECRET` |

لا توجد جداول مشفّرة أخرى في المصدر بتاريخ هذا الجرد. إضافة جدول ثالث يستلزم إضافته إلى `SecretRotationService` في نفس التغيير.

كلمات مرور الحسابات تُهشَّش بـ bcrypt وليست ظروفاً قابلة للاستعادة. رموز التجديد تُهشَّش SHA-256.

## أسرار ليست في البيئة

| الاسم | الموقع | المالك |
|---|---|---|
| توكنات الجلسة (`access_token` / `refresh_token`) | كوكيز التطبيقات؛ صفوف `refresh_tokens` (هاش) | أمن |
| رموز OTP | جدول `otps` (هاش) | أمن |
| Stripe publishable key | `STRIPE_PUBLISHABLE_KEY` | عامة بالتصميم |

## تعرض تاريخي

قيم حقيقية وُجدت سابقاً في ملفات متتبَّعة (Neon، JWT، Bunny، Sentry auth token، مفاتيح نماذج). placeholders كُتبت في `.env.example`. **الإلغاء عند المزود يبقى عمل تشغيل (P01-T09 / بند TODO تدوير الاعتمادات).** هذا الجرد لا يغلق ذلك.

تدوير التشفير المعزول على Docker `zaydak` بتاريخ 2026-09-16: انظر [p01-secret-rotation-log.md](p01-secret-rotation-log.md). `SECRETS_ENCRYPTION_KEY_PREVIOUS` غير مضبوط في تلك البيئة بعد `failed=0`. إنتاج Render لم يُدوَّر في ذلك الإجراء.
