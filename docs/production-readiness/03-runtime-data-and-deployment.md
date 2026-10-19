# P03 — التشغيل والبيانات والنشر

| الحقل | القيمة |
|---|---|
| المعرّف | P03 |
| الحالة | قيد التنفيذ |
| المسؤول | مسؤول التشغيل وقاعدة البيانات؛ مسؤول الواجهة الخلفية |
| الأولوية | حاجب إطلاق؛ يلزم قبل تجربة قبول على بيئة مماثلة للإنتاج |
| يعتمد على | P00 وP01 وP02 للإغلاق؛ الجرد وتجارب النسخ المعزولة تبدأ مبكراً |
| يفتح | إغلاق P04 وتجارب P05–P10 على staging |
| آخر تحديث للخطة | 2026-09-17 |

## الهدف

بناء بيئة معروفة وقابلة لإعادة النشر والاستعادة، لا تعتمد على إعدادات يدوية مجهولة أو قاعدة بيانات غير محددة أو طوابير تتوقف دون إنذار.

## المشكلة والأدلة

| البند | الدليل وحدوده |
|---|---|
| النشر كان يغيّر المخطط وقت البناء | [render.yaml](../../render.yaml) كان يشغّل `db:deploy` = `prisma db push`. **حدّث المستودع:** `db:deploy` = `prisma migrate deploy` + baseline تحت `prisma/migrations/`. قطع قواعد موجودة يتطلب `db:resolve-*` مرة واحدة (موثّق). |
| SQL يدوي | نُقل الأرشيف إلى [`prisma/manual/`](../../back-end/prisma/manual) حتى لا يُحسب مجلدًا لـMigrate (P3015). |
| الصحة | `HealthModule`: `/health` liveness، `/ready` Postgres+Redis. Render يبقى على `/health`. |
| سعة الاتصالات | `DATABASE_POOL_MAX` (افتراضي 20) في `PrismaService`. |
| Redis محلي | الحاوية الحيّة `zaydak-redis` (compose على القرص اسمه `zaydak`): `maxmemory-policy=noeviction`، `maxmemory=512mb` (536870912). Upstash المستضاف لم يُلمس. |

## الحل المعتمد

1. جرد بيئات من المستودع + فصل معروف/محجوب ([p03-runtime-inventory.md](p03-runtime-inventory.md)).
2. مسار نشر يفصل البناء عن تغيير القاعدة عبر `migrate deploy` ([p03-migrations-workflow.md](p03-migrations-workflow.md)).
3. baseline مثبت على فارغة وعلى `zaydak` بعد resolve.
4. snapshot/restore محلي مقاس ([p03-backup-restore-drill.md](p03-backup-restore-drill.md))؛ إنتاج محجوب.
5. Redis `noeviction` موثّق؛ عمال داخل API مع ميزانية pool قابلة للضبط.
6. `/ready` في الكود والصورة؛ Render health = `/health`.

## المهام بالترتيب

- [x] **P03-T01** — جرد من المستودع: Render blueprint، Vercel.json×3، Neon/Upstash كما في docs، Compose `zaydak`، CI. **محجوب بلا لوحة:** IDs الحية والخطط الفعلية. الدليل: [p03-runtime-inventory.md](p03-runtime-inventory.md).
- [~] **P03-T02** — فصل staging/prod في المستودع: `.env.staging.example`، ملاحظات compose، توثيق أن موارد المزود غير مُنشأة. **محجوب:** اختيار مشروع Neon/Redis staging الفعلي.
- [x] **P03-T03** — snapshot+restore على Docker `zaydak` فقط: dump 3.66s / restore 20.31s؛ 182 جدولًا، 68 مستخدمًا، 8 تكاملات. أهداف D08: RPO&lt;15m / RTO&lt;30m. **تمرين إنتاج محجوب.** [p03-backup-restore-drill.md](p03-backup-restore-drill.md).
- [x] **P03-T04** — baseline `20260916200000_baseline` + `20260916200001_partial_indexes`؛ نقل `manual/` خارج `migrations/`؛ فارغة: migrate نجحت (~170 جدولًا + فهرس جزئي)؛ `zaydak`: resolve ثم لا pending.
- [x] **P03-T05** — `db:deploy` → `migrate deploy`؛ `db:push` منفصل؛ CI و`render.yaml` وdocs؛ إجراء قطع resolve موثّق. **تطبيق resolve على Neon إنتاج: محجوب (مشغّل).**
- [~] **P03-T06** — بذور: `sync:permissions` + `seed:plans` في البناء (additive)؛ `seed`/`taxonomy` يدوي؛ `ALLOW_PROD_SEED` موثّق. **`check:drift` على staging/prod محجوب.**
- [~] **P03-T07** — مطابقة build/start في المستودع (`rootDir: back-end`، lockfile مستقل، `NODE_ENV=production` في blueprint). **قيم CORS/URLs الحية وenforce على Render محجوبة.**
- [~] **P03-T08** — Docker-as-prod Redis (`zaydak-redis` الحي): `maxmemory-policy=noeviction`، `maxmemory=512mb` بعد recreate 2026-09-17. هذا سقف سياسة+ذاكرة على الحاوية، **ليس** خطة مدفوعة. compose يحمل نفس الأمر. **Upstash المستضاف لم يُلمس.**
- [~] **P03-T09** — عمال داخل عملية API (~20 `@Processor`)؛ `DATABASE_POOL_MAX` للميزانية؛ فصل عمال مؤجّل حتى قياس حمل. لا consumer مكرر منفصل في المستودع.
- [x] **P03-T10** — `/health` + `/ready`؛ Dockerfile من جذر المونوريبو مع `packages/emails`؛ HEALTHCHECK=`/health`؛ Render `healthCheckPath: /health`. إثبات صورة: `docker compose build api` + up → `GET /health` 200، `GET /ready` 200 `{database:up,redis:up}` (2026-09-16).
- [ ] **P03-T11** — بريد/SMS حقيقي — خارج جولة البنية هذه (تنسيق P01).
- [ ] **P03-T12** — DNS/HTTPS/نشر staging كامل — محجوب بلا موارد staging.

## المخرجات المطلوبة

- [x] سجل بيئات منقّح (مستودع vs محجوب).
- [x] baseline وmigrations وإجراء قطع.
- [x] سجل نسخة محلية مقاسة؛ إنتاج محجوب بصدق.
- [~] runbook نشر محدّث في `back-end/docs/10_deployment`؛ OTP/DNS تبقيان مفتوحتين.

## أوامر

```powershell
cd back-end
npm run db:migrate          # prisma migrate deploy
npm run db:push             # طوارئ محلية فقط
npm run db:resolve-baseline # مرة لكل قاعدة قديمة
npm run db:resolve-partial
npm run check:drift
# من جذر المستودع:
docker compose build api
docker compose up -d api
curl.exe http://127.0.0.1:3000/ready
```

## شروط القبول

- [~] هوية قاعدة الإنتاج — موثّقة كمحجوبة بلا لوحة؛ local `zaydak` محسومة.
- [x] مسار migrations بلا `db push` في build الإنتاج (المستودع).
- [ ] permissions/`check:drift` على البيئة المعيّنة للإطلاق — يحتاج staging/prod.
- [~] إعدادات production — blueprint محدّث؛ القيم الحية محجوبة.
- [~] Redis noeviction — Docker-as-prod `zaydak-redis` 512mb + noeviction مثبت 2026-09-17؛ Upstash محجوب (لم يُلمس).
- [ ] التسليم والنطاقات — T11/T12.
- [x] RPO/RTO محلي مقاس؛ إنتاج محجوب.

## سجل التنفيذ

| التاريخ | المهمة | المنفّذ | التغيير أو الدليل | النتيجة | المتبقي |
|---|---|---|---|---|---|
| 2026-09-16 | P03-T10 | تنفيذ محلي | `HealthModule` + حيّ مضيف سابقًا | كود جاهز؛ صورة Docker قديمة بلا `/ready` | إعادة بناء الصورة |
| 2026-09-16 | T01–T05, T10 | تنفيذ محلي | جرد؛ staging example؛ dump/restore؛ baseline+migrate؛ نقل `prisma/manual`؛ Docker monorepo+emails؛ `DATABASE_POOL_MAX`؛ Sentry cast لبناء الصورة | فارغة+zaydak migrate OK؛ backup 3.66s/20.31s؛ صورة: `/health`+`/ready` 200 | resolve Neon؛ staging مستضاف؛ T11/T12؛ لوحات المزود |
| 2026-09-17 | P03-T08 / B30 | تنفيذ محلي | Recreate `zaydak-redis`: `--maxmemory 512mb --maxmemory-policy noeviction --appendonly yes`. إثبات `CONFIG GET`: policy=noeviction، maxmemory=536870912 (512.00M). ليس خطة مدفوعة. Upstash لم يُلمس. | نجاح Docker-as-prod | حصة Upstash المستضافة |
