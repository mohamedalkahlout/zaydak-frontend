# P01 — سجل تدوير تشفير الأسرار (بدون قيم)

**التاريخ:** 2026-09-16  
**البيئة:** Docker Compose المحلي `zaydak` فقط (`zaydak-api`، `zaydak-postgres` على `localhost:5432` / قاعدة `zaydak`، `zaydak-redis`). تأكيد قبل أي تغيير: مضيف قاعدة الـAPI هو `postgres` داخل الشبكة، و`localhost` من المضيف — ليست Neon وليست إنتاجاً.  
**القاعدة:** هذا الملف أسماء وجداول وأعداد وبصمات قصيرة. لا قيم مفاتيح ولا مقتطفات اعتماد.

## الإجراء

`SecretRotationService` يعمل عند الإقلاع (`OnApplicationBootstrap`) إذا وُجد `SECRETS_ENCRYPTION_KEY_PREVIOUS`. لا يوجد أمر CLI منفصل. مسار قراءة المفتاح السابق في `SecretCryptoService` **بقي في الكود** عمداً حتى لا ينكسر نشر بشكل إنتاجي؛ ما أُزيل هو المتغير من بيئة `zaydak` بعد اكتمال التدوير.

الجداول التي يغطيها التدوير (AAD كما في [secrets-inventory.md](secrets-inventory.md)):

| الجدول.العمود | صفوف غير فارغة قبل التدوير |
|---|---|
| `integration_configs.credentials` | 8 |
| `shipping_provider_accounts.credentials` | 1 |
| `shop_whatsapp_instances.webhook_secret` | 4 |
| `platform_whatsapp_instances.webhook_secret` | 1 |
| `shop_telegram_bots.bot_token` / `.webhook_secret` | 0 |
| `platform_telegram_bots.webhook_secret` | 0 |

## النسخة الاحتياطية

- ملف: `back-end/.tmp/zaydak-p01-t08-20260916.dump` (gitignored؛ صيغة `pg_dump -Fc`).
- إثبات الاستعادة (قاعدة رمي ثم حذف، ليست `zaydak` الحية): `pg_restore` إلى `zaydak_p01_restore_check` أعاد 8 تكاملات، 1 حساب شحن، 4 واتساب متجر، 1 واتساب منصة، 59 مستخدماً، ثم `dropdb`.

استعادة بيئة `zaydak` نفسها عند الفشل: إيقاف الـAPI، استعادة الـdump على قاعدة `zaydak`، إعادة `SECRETS_ENCRYPTION_KEY` القديم من مخزن المفاتيح المحلي (gitignored)، إعادة التشغيل **بدون** `SECRETS_ENCRYPTION_KEY_PREVIOUS`. استرجاع إصدار الخدمة وحده لا يعيد تشفير الصفوف.

## المفاتيح (بصمات فقط)

| الاسم | الحالة بعد الإجراء | `sha256` أول 12 | آخر 4 | الطول |
|---|---|---|---|---|
| `SECRETS_ENCRYPTION_KEY` السابق | نُسخ إلى PREVIOUS أثناء النافذة ثم لم يعد في بيئة الحاوية | `bc5911a3b604` | `6d41` | 64 hex |
| `SECRETS_ENCRYPTION_KEY` الحالي | مضبوط في `.env` المحلي (gitignored) | `71e5be302f57` | `1628` | 64 hex |
| `SECRETS_ENCRYPTION_KEY_PREVIOUS` | غير مضبوط بعد الاكتمال | — | — | — |
| `APP_SECRET` (مصدر Nest: `.env.development`) | دُوِّر محلياً بعد نجاح التشفير | من `cd5a6482ed6f` إلى `4c827a75becd` | إلى `c606` | 64 hex |

لم تُرتكب قيم في git.

## نتائج التدوير

1. إقلاع بنافذة PREVIOUS: **14 re-encrypted, 0 already current, 0 unreadable** (`failed=0`) — تكاملات 8/0، ناقل 1/0، واتساب 5/0، تيليجرام 0/0.
2. إعادة الإقلاع بنفس النافذة: **0 re-encrypted, 14 already current, 0 unreadable** — الرسالة: `Rotation is complete — unset SECRETS_ENCRYPTION_KEY_PREVIOUS`.
3. إقلاع بالمفتاح الجديد وحده (PREVIOUS غير مضبوط): لا سجل تدوير، لا `DECRYPTION_FAILED`.
4. فك مستقل ضد Postgres: 14/14 بالمفتاح الجديد، 0/14 بالقديم.
5. GraphQL على `localhost:3000` بعد حذف PREVIOUS: `integrationConfigs` 8 صفوف بأقنعة سرية ذات لاحقة (ليست قائمة فارغة)؛ `shippingProviderAccounts` لمتجر `ahmed-electronics` صف OTO واحد بقيم مقنّعة؛ `myWhatsAppInstance` يقرأ الحالة (`disconnected`) بلا خطأ فك.

اختبارات الوحدة بعد ذلك: `npx jest secret-rotation.service.spec auth.service.spec` — 87 نجحت.

## `APP_SECRET` وروابط الدخول

تدوير `APP_SECRET` المحلي بعد أن أصبح التشفير على المفتاح المخصّص. تسجيل الدخول بكلمة المرور نجح بعد إعادة التشغيل (متوقع أن تموت الروابط السحرية واشتقاق سر ويب هوك تيليجرام المنصة إن وُجد بلا صف). لم يُمس `JWT_SECRET`. جلسات الإنتاج وروابط الويب هوك الحقيقية **لم تُختبر ولم تُغيَّر**.

## ما لم يُنفَّذ (تشغيل إنتاج — خارج إغلاق التطوير المحلي)

صفوف التكامل المحلية تشير إلى مزودين حقيقيين بالاسم (Resend، Groq، OpenRouter، Telegram، ScrapingBee، OTO، Evolution). **لم يُلغ أي اعتماد عند المزود** — وليست مفاتيح تجريبية مؤكدة.

**قرار 2026-09-16 (صاحب المنتج / تشغيل):** بيئة العمل الحالية **تطوير** بقيم مختلفة عن الإنتاج. إلغاء اعتمادات git-history عند المزودين وتدوير أسرار Render/Neon/Upstash/Stripe/Sentry/Replicate/Bunny **ملك تشغيل الإنتاج** وخارج نطاق إغلاق P01 المحلي لهذه الجولة. لا تُستدعى لوحات المزودين ولا تُمس بيئة الإنتاج من مسار التطوير. يبقى البند `[~]` وشرط القبول «لا سر مكشوف صالح بدون معالجة» مفتوحاً حتى ينفّذ التشغيل ذلك على الإنتاج.

لا تدوير إنتاج، لا نسخة احتياطية لقاعدة الإنتاج، لا تنسيق ويب هوك لمضيف منشور في هذه الجولة.
