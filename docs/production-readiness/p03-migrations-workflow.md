# P03 — مسار migrations المعتمد

**Last updated:** 2026-09-17

## القرار

| أمر | المعنى |
|---|---|
| `npm run db:deploy` / `db:migrate` | `prisma migrate deploy` — مسار CI وRender |
| `npm run db:push` | `prisma db push` — محلي/طوارئ فقط؛ **ليس** في build الإنتاج |
| `npm run db:resolve-baseline` | مرة واحدة لكل قاعدة موجودة مسبقًا (تاريخيًا عبر push) |
| `npm run db:resolve-partial` | مرة واحدة لنفس القواعد لـ`20260916200001_partial_indexes` |
| `npm run migrate:local -- <filter>` | يطبّق ملفات `prisma/manual/*.sql` على loopback فقط |

## المجلدات

| المسار | الدور |
|---|---|
| `prisma/migrations/<timestamp>_*/migration.sql` | migrations Prisma الرسمية (baseline + التغييرات اللاحقة) |
| `prisma/manual/*.sql` | أرشيف SQL يدوي تاريخي + كائنات لا يعبّر عنها Prisma؛ **خارج** `migrations/` حتى لا يفشل `migrate deploy` بـP3015 |
| `migration_lock.toml` | `provider = postgresql` |

## قطع قواعد موجودة (staging/prod بعد أول نشر يبدّل الأمر)

1. خذ snapshot.
2. ضد الـdirect URL: `npm run db:resolve-baseline` ثم `npm run db:resolve-partial`.
3. `npm run db:migrate` — يجب أن يقول لا pending.
4. بعدها فقط اعتمد build الذي يشغّل `db:deploy`.

## إثبات محلي (2026-09-16)

| سيناريو | نتيجة |
|---|---|
| قاعدة فارغة `zaydak_p03_empty` + `migrate deploy` | نجحت؛ 2 migrations؛ ~170 جدولًا في `public`؛ الفهرس الجزئي `integration_configs_one_enabled_per_type` موجود |
| `zaydak` الحية + resolve ثم deploy | لا pending؛ صفّان في `_prisma_migrations` |
| Docker-as-prod `zaydak` 2026-09-17 | `20260917140000_balance_gross_sales_and_commission_tiers` applied؛ عمود `gross_sales_cents` + 3 شرائح منصة |
| credit-once unique (2026-09-17) | `20260917190000_credit_once_unique_index` applied on loopback `zaydak` after inspect 0 duplicates |
| إنتاج Neon | **محجوب** — يلزم resolve من مشغّل بوصول وحدة التحكم |

## فشل البناء عند migration

- فشل `migrate deploy` يوقف أمر بناء Render قبل `start` — لا يصل إصدار جديد للمرور.
- لا يُشغَّل seed أو sync قبل نجاح migrate في `render.yaml` الحالي (الترتيب: build → db:deploy → sync → seed:plans).

## expand / backfill / contract

للتغييرات الهدامة: أضف عمودًا/جدولًا جديدًا أولًا (expand)، انشر كودًا يكتب القديمين، backfill بملف `prisma/manual/` أو migration لاحقة، ثم contract في migration منفصلة بعد إثبات القراءة من الشكل الجديد. لا تعتمد على `db push --accept-data-loss`.
