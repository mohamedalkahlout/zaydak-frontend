# P03 — جرد التشغيل والنشر (من المستودع)

**Last updated:** 2026-09-17  
**المصدر:** ملفات المستودع + Docker-as-prod الحي (`zaydak-*` الحاويات). Compose على القرص اسمه `zaydak`؛ لا تُشغَّل كومة ثانية.  
**ليس مصدرًا:** لوحات Render / Vercel / Neon / Upstash الحية (لا دخول وحدة تحكم في هذه الجولة).

## معروف من المستودع

| المورد | ما يثبته المستودع | ملاحظات |
|---|---|---|
| API hosting | [`render.yaml`](../../render.yaml): خدمة `zaydak-backend`، `runtime: node`، `region: virginia`، `plan: free`، `rootDir: back-end`، `autoDeploy: true`، `healthCheckPath: /health`، `startCommand: npm run start:prod` | إعداد Blueprint؛ قد يختلف حساب Render الفعلي عن الملف إن عُدّل من اللوحة دون مزامنة |
| API build | `npm ci --include=dev && npx prisma generate && npm run build && npm run db:deploy && npm run sync:permissions && npm run seed:plans` | حتى قطع P03 كان `db:deploy` = `prisma db push` |
| DB (مذكور في docs) | Neon، منطقة متوافقة مع `virginia` / `us-east-1`، اتصال pooler للتطبيق وdirect لـ Prisma CLI (`prisma.config.ts` يزيل `-pooler`) | **هوية المشروع والمنطقة الفعلية: محجوبة** بلا لوحة Neon/Render |
| Redis (مذكور في docs) | Upstash TCP `rediss://`؛ يُطلب `noeviction` في [10_deployment](../../back-end/docs/10_deployment/README.md) | **خطة/حصة/سياسة الإخلاء الفعلية: محجوبة** بلا لوحة Upstash |
| Frontends | `apps/{vendor,admin,storefront}/vercel.json`: Next.js، `npm install` ثم `npm run build` | لا أسماء مشاريع ولا env في المستودع |
| Local stack | `docker-compose.yml` name `zaydak` على القرص؛ **الحاويات الحيّة** `zaydak-postgres` / `zaydak-redis` / `zaydak-api`، قاعدة `zaydak` | لا `docker compose up` لملف zaydak — سيبدأ كومة ثانية |
| CI | `.github/workflows/ci.yml`: Postgres scratch `zaydak_ci`، كان يشغّل `db:deploy` ثم seeds + `check:drift` | لا ينشر؛ لا يرى Render |

### متغيرات البيئة (أسماء فقط)

من `render.yaml` + `back-end/.env.example` + docs: `DATABASE_URL`، `MIGRATE_DATABASE_URL` (اختياري)، `REDIS_URL` / `REDIS_*`، `JWT_SECRET`، `APP_SECRET`، `SECRETS_ENCRYPTION_KEY`، `CORS_ORIGINS`، `FRONTEND_URL` / `SHOP_URL` / `DASHBOARD_URL` / `VENDOR_URL`، ومفاتيح المزودين. القيم الحية ليست في git.

## محجوب بلا دخول وحدة تحكم

- IDs الفعلية لخدمات Render ومشاريع Vercel ومشاريع Neon وقواعد Upstash.
- هل الـBlueprint مطبّق حرفيًا أم تجاوزته إعدادات اللوحة (أمر البناء، الخطة، المنطقة، health path).
- نسخ Neon الاحتياطي التلقائي، PITR، وملكية تنبيه فشل النسخ.
- فصل staging عن production على المزودين (مشروع DB منفصل، Redis منفصل، مشاريع Vercel preview/staging).
- إثبات `CORS_ORIGINS` وURLs الإنتاجية الحالية.

## إثبات محلي (2026-09-16)

| فحص | نتيجة |
|---|---|
| حاويات | `zaydak-postgres` / `zaydak-redis` / `zaydak-api` healthy |
| Postgres | قاعدة `zaydak`، ~182 جدولًا عامًا، حجم ~41 MB |
| Redis | `maxmemory_policy:noeviction`، `used_memory_human:5.25M`، `maxmemory=0` (بلا سقف) |
| `GET /health` على الحاوية القديمة | 200 `{"status":"ok"}` |
| `GET /ready` على الحاوية | **200** بعد إعادة البناء 2026-09-16: `{database:up,redis:up}` |
| `DATABASE_URL` في `.env` المضيف | مضيف `localhost` (ليس Neon) |

## إثبات Docker-as-prod (2026-09-17)

الحاويات الحيّة تم توحيدها كـ `zaydak-*` وملف compose يحمل `name: zaydak`. الإثبات ضد الكومة الجارية فقط.

| فحص | نتيجة |
|---|---|
| حاويات | `zaydak-postgres` / `zaydak-redis` / `zaydak-api` healthy |
| Postgres | قاعدة `zaydak` على localhost:5432؛ migrate `20260917140000_...` مطبّقة |
| Redis recreate | `CONFIG GET maxmemory-policy` = `noeviction`؛ `maxmemory` = `536870912` (512.00M)؛ `used_memory_human` ~1.65M |
| Upstash | **لم يُلمس** |

## فصل البيئات (الواقع المقترح في المستودع)

| بيئة | الواقع قبل P03 | الهدف في المستودع |
|---|---|---|
| local | Compose `zaydak` + `.env` / `.env.development` | يبقى؛ لا يلمس إنتاجًا |
| staging | **غير موجود كموارد مزوّد موثّقة** | قوالب env + profile compose؛ إنشاء موارد المزود ملك تشغيل |
| production | موصوف في docs/blueprint فقط | migrations معتمدة؛ لا `db push` في مسار النشر |

انظر [03-runtime-data-and-deployment.md](03-runtime-data-and-deployment.md) و[p03-backup-restore-drill.md](p03-backup-restore-drill.md).
