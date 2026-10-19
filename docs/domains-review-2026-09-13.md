# Zaydak Domains — الوضع الحالي، الفروقات مع شوبيفاي، والمقترحات

**تاريخ المراجعة:** 2026-09-13
**النطاق:** `back-end/src/shop-domains/`, `apps/storefront/src/proxy.ts`, `apps/vendor/src/features/settings/**/domains*`, `apps/admin/src/app/shops/[shopId]/domains`

مراجعة نقطة-زمنية، مش وثيقة حيّة. وثائق الميزة الرسمية بـ`back-end/docs/features/shop-domains.md`.

---

## 1. الخلاصة بثلاث جمل

الباك إند للدومينات **بمستوى شوبيفاي أو أدق منه** في تشخيص الـDNS — بنكتشف ١٣ من ١٥ حالة فشل موثّقة عند شوبيفاي وبتنطبق علينا، وبدقّة تفوق توثيقهم في CAA تحديداً.

اللي بيفصلنا عن تجربة شوبيفاي **مش الكشف، الإيصال**: الواجهة بتخبّي جواب السيرفر بالضبط في الحالات اللي بنيناه عشانها.

وفي نص تاني من شوبيفاي ما لمسناه إطلاقاً وهو **«الدومين كمنتج»** — شراء، استضافة DNS، نقل، تحويل بريد. هذا قرار نطاق واعي، مش فجوة.

---

## 2. اللي معمول حالياً

### 2.1 أرقام

| | |
|---|---|
| ملفات الباك إند للميزة | 28 (منها 10 spec) |
| اختبارات الميزة لحالها | 285 |
| اختبارات الريبو كاملاً | 6073 back-end · 1305 vendor · 635 storefront · 283 admin · 263 ui |
| lint / typecheck | صفر أخطاء |

### 2.2 العناوين اللي المتجر بيجاوب عليها

```
zaydak.com/acme/products/mug      path mode   — سطح تصفّح الماركتبليس
acme.zaydak.com/products/mug      host mode   — العنوان المشتق من الـhandle
acme.com/products/mug             custom      — دومين التاجر
```

حلّ الـtenant **نقي ومتزامن**: الـsubdomain *هو* الـhandle، فبينقرأ قراءة بدون قاعدة بيانات ولا كاش. الدومين المخصص هو الوحيد اللي بده lookup.

### 2.3 محرك التحويل (serve / redirect)

دالة وحدة بالباك إند بتقرر مصير أي عنوان:

```
ShopDomainsService.resolveDomainRequest(hostname)
  → { slug, role: PLATFORM|PRIMARY|ALIAS, action: SERVE|REDIRECT, primary_hostname }
```

الـproxy بالـstorefront بينفّذ القرار بـ**308** مع الحفاظ على المسار والـquery:

```
ahmed-electronics.zaydak.com/products/123?ref=ad
        ↓ 308
https://ahmedstore.com/products/123?ref=ad
```

**الـrole مشتق مش مخزّن** — قراءة لـ`is_primary` + أي عنوان هو عنوان المنصة. ما في migration وما في حقل ممكن يتناقض مع الصف.

**أمان الـloop بنيوي مش فحص:** `primary_hostname` بينحط بس لما يختلف عن الهوست المسؤول عنه، و`primaryHostname` بتشترط `ACTIVE`. وفوقها: **ما بنكاش قرار التحويل إطلاقاً** — في دومين primary واحد بأي لحظة، فقراءة متسقة ما بتقدر تخلي هوستين يأشروا لبعض؛ كل loop ممكن مصدره جوابين قديمين مختلفين بين instances.

### 2.4 تشخيص الـDNS مقابل حالات شوبيفاي الموثّقة

| # | حالة شوبيفاي | عنا | الملف |
|---|---|---|---|
| 1 | A مش مشير علينا | ✅ UPDATE | `dns/domain-dns-diff.service.ts` |
| 2 | A متعددة | ✅ REMOVE | `dns/domain-dns-diff.service.ts` |
| 3 | CNAME مش مشير | ✅ UPDATE | `dns/domain-dns-diff.service.ts` |
| 4 | CNAME ناقص | ✅ ADD | `dns/domain-dns-diff.service.ts` |
| 5 | Cloudflare proxy شغّال | ✅ إثبات بالـCIDR | `dns/dns-provider-detector.ts` + `dns/proxy-ranges.ts` |
| 6 | CAA بتمنع الـCA | ✅ | `dns/caa-policy.service.ts` |
| 7 | CAA فيها `;` | ✅ | `dns/caa-policy.service.ts` |
| 8 | AAAA مش مشير | ✅ REMOVE | `dns/domain-dns-diff.service.ts` |
| 9 | AAAA متعددة | ✅ | `dns/domain-dns-diff.service.ts` |
| 10 | DNSSEC (مزوّد خارجي) | ✅ | `dns/dnssec-inspector.service.ts` |
| 11 | DNSSEC (دومين مُدار من شوبيفاي) | — لا ينطبق | ما بنستضيف دومينات |
| 12 | TLS pending | ✅ | `checks.tls` |
| 13 | SSL unavailable | ✅ `tls: FAILED` | `shop-domains.service.ts` |
| 14 | nameservers غير متوقعة | ⚠️ جزئي | بنسمّي المزوّد، ما بنقول «غير متوقع» |
| 15 | فشل قراءة الـzone | ✅ `zone_unreachable` | `dns/dns-inspector.service.ts` |
| 16 | Wildcard record | ❌ | — |

**١٣ مغطّاة، وحدة جزئية، وحدة ناقصة، وحدة ما بتنطبق.**

### 2.5 وين إحنا أدق من شوبيفاي

- **تسلّق CAA حسب RFC 8659.** الـCA بتتسلّق من الاسم نفسه لفوق وبتوقف عند **أول** اسم فيه أي CAA — مش «سجلات الـapex». توثيق شوبيفاي بيقول «CAA» وبس. وبنكتشف الحالات القاتلة: القيمة الفاضية، `";"`، و**النقطة الزائدة** (`letsencrypt.org.` بتبيّن صح وبتمنع الكل).
- **`dns_propagated` فحص حقيقي.** بنقارن resolver-ين مستقلين، فـ«مضبوط» و«انتشر» سؤالين مختلفين مش نفس الحقيقة مطبوعة مرتين.
- **إثبات الـproxy باتجاه واحد.** داخل النطاق = مُوكّل، أكيد. خارج النطاق = **ما بيثبت إشي** (BYOIP)، فالدالة ما بتقدر تدّعي «مش مُوكّل».
- **الـdiff بيرفض يلمس اللي مش إلنا.** بس الخانة `(type, name)` اللي سجل مطلوب بيحتاجها. MX وSPF وDKIM وDMARC **ما بينظر فيهم إطلاقاً**.

### 2.6 اللي بنيناه غير التشخيص

- **مسح ليلي** (`50 4 * * *`, 100 صف/مرة) بسياسة **ضربتين** قبل الخفض، وتنبيه `SHOP_DOMAIN_STOPPED_SERVING` — `critical` للـprimary و`warn` لغيره
- **عزل مستأجرين**: كل قراءة صف بتحمل `shop_id`؛ ما في helper بياخد id لحاله
- **CORS لدومينات التجار**: القائمة الساكنة أول، وبعدين `isTrustedOrigin` من قاعدة البيانات — `https:` فقط، بدون port، **وبتفشل مقفولة**
- **واجهة الأدمن** للقراءة فقط على `/shops/[shopId]/domains`
- **واجهة التاجر**: جدول، شاشة تفصيل، diff، checklist بخمس فحوصات منفصلة، حوارات (ربط، تعيين primary، حذف، تغيير العنوان)، وروابط شراء خارجية

---

## 3. الفروقات مع شوبيفاي

### 3.1 «الدومين كمنتج» — النص اللي ما لمسناه

| | شوبيفاي | عنا |
|---|---|---|
| شراء دومين من اللوحة | ✅ تسجيل + تجديد تلقائي + WHOIS privacy | روابط خارجية فقط |
| استضافة DNS | ✅ للدومينات المشتراة منهم | ❌ ولا مرة بنستضيف zone |
| نقل دومين (EPP/auth code) | ✅ | ❌ |
| تحويل بريد | ✅ `support@shop.com → gmail` | ❌ |
| دومين لكل سوق/لغة | ✅ Shopify Markets | ❌ |

كل هدول بدهم **تكامل registrar حقيقي** (OpenSRS / Tucows / Enom / Namecheap API) — مش Vercel. مشروع منفصل بحاله.

### 3.2 فروقات سلوكية ضمن اللي بنيناه

**`www` + apex كزوج.** شوبيفاي بتعاملهم كوحدة؛ عنا دومينين منفصلين تماماً. أكبر فجوة UX ضمن النطاق الحالي.

**حالات خطأ نهائية.** شوبيفاي بتسمّي حالاتها («SSL unavailable»، «We couldn't verify your domain»). عنا `ShopDomainStatus.FAILED` **ما بتنكتب أبداً** — كل المسارات بتنتج ACTIVE أو VERIFYING، فدومين مكسور نهائياً بيضل «Verifying» للأبد.

**عنوان تالت.** `zaydak.com/acme` بيضل يخدم ٢٠٠ حتى بعد ترقية دومين مخصص. قرار واعي — هذا سطح تصفّح الماركتبليس، وتحويله بيطلّع كل نقرة من دليل المتاجر بره المنصة. شوبيفاي ما عندها ماركتبليس فما عندها هالمسألة أصلاً.

**شهادات تلقائية.** `VERCEL_TOKEN` مش مضبوط، فالمنصة على `ManualDomainProvider`: بتطبع السجلات وبتفحصها، بدون إصدار شهادة تلقائي. إعداد مش كود.

---

## 4. المقترحات

### P0 — قبل ما نقول الميزة جاهزة للإنتاج

**أعمال بيئة (مش كود):**

| البند | الوضع | التفصيل |
|---|---|---|
| تدوير الأسرار | 🔴 | انكشفت بالمحادثة. `SECRETS_ENCRYPTION_KEY` **لحاله** — بده إعادة تشفير `integration_configs` قبل التبديل |
| `STOREFRONT_CNAME_TARGET` | 🔴 | القيمة العامة `cname.vercel-dns.com`. كل subdomain بياخد سجل ما بيحل. خُد `<hash>.vercel-dns-<n>.com` من Vercel → المشروع → Settings → Domains |
| `STOREFRONT_APEX_IP` | 🟡 | `76.76.21.21` — أكّدها، مشاريع Vercel الأحدث بتاخد من pool |
| `NEXT_PUBLIC_ROOT_DOMAIN` | 🟡 | على Vercel، غير مرئي. **بدونه host mode كله مطفي** |
| `VERCEL_TOKEN` + `VERCEL_STOREFRONT_PROJECT_ID` | 🟡 | بدونهم ربط يدوي لكل دومين |

**أعمال كود — من تقييم عدائي (٣٠ نتيجة، ٩ مؤكدة):**

أهمهم بالترتيب:

1. **التحذيرات مخبّية.** `config.warnings` بتنعرض كـchildren لـ`DomainChecklist`، واللوحة بتنفتح حسب `!dns_configured` — فالتحذير بينقمع **لما السجلات تكون مضبوطة**، وهاي بالضبط حالة CAA وDNSSEC. *أعلى أثر لأقل شغل: طلّعها بره الـchecklist.*
2. **«Redirects to X» غلط.** بتنقال من `!is_primary` لحاله. التحويل بيصير بس لما صف **مخصص** يكون primary **و**ACTIVE.
3. **تحذير الـproxy بيسمّي قيمة الشاشة ما بتعرضها.** بنفرّغ الـdiff عند إثبات الـproxy، فـ«غيّرها للقيمة فوق» بتأشر على لا شي.
4. **ما في إعادة فحص لدومين ACTIVE.** زر Verify مقفول على `status !== ACTIVE`؛ دومين انكسر بعد التفعيل ما بينفحص غير بالمسح الليلي (ضربتين، لحد يومين) والشاشة فوقه «Connected» خضرا.
5. **استعلام فاشل = بطاقة فاضية.** ما في `errorPolicy` ولا `onError`.
6. **`ShopDomainStatus.FAILED` ما بتنكتب.** الحالة الحمرا كود ميت.
7. **الفيندور بيشتق عنوان المنصة من env حاله** بدل ما يقرا اللي السيرفر رجّعه — شاشة وحدة بتعطي جوابين.
8. **`VercelDomainProvider` بيجيب `recommendedCNAME`/`recommendedIPv4` وما بيقراهم** — فبيضل يطبع افتراضيات الـenv بدل أهداف المشروع.

*انصلح بالمراجعة:* `verifyShopDomain` كان **الوحيد** اللي ما بيمسح كاش القرار — الـinvalidation كانت محطوطة على `verify()` وهي dead code. التاجر يضغط Verify، الصف يصير ACTIVE، ودومينه يضل «ما في متجر هون» لحد ما تنتهي الـTTL.

**دين تقني بيحد الصحة:**

- **`CACHE_MANAGER` مش Redis.** `RedisModule` بتمرّر `store:` (مفرد، أسلوب cache-manager v5) و`@nestjs/cache-manager` v3 بيقرا `stores:` — فبينتجاهل بصمت وبيقع على ذاكرة in-process. كل كاشات الريبو per-process، والـinvalidation بتمسح instance وحدة. الإصلاح: `stores: [new Keyv({ store: new KeyvRedis(url) })]` عبر `@keyv/redis`. **مؤجل بقصد** — بيغيّر سلوك أربع ميزات تانية وبيلمس مسار إقلاع Redis اللي وقّع الإنتاج مرة.
- **`src/schema.gql` قديمة** — بتتولّد عند الإقلاع، متسجّلة بالـgit، وما فيها `domainRequest` ولا `ShopDomainRole`.
- **`ShopDomainsService.verify()` كود ميت** — نفس شغل `configuration({persist:true})` بدون مستهلك. وجودهم سوا هو اللي أنتج باگ الـinvalidation.

### P1 — يقرّب التجربة من شوبيفاي

- **`www` + apex كعائلة** — يفحص الاتنين ويعرض العلاقة. **بدون ما نعدّل DNS نيابة عن التاجر.**
- **حالات خطأ نهائية مسمّاة** — يكتب `FAILED` مع سبب، بدل «Verifying» للأبد
- **canonical + sitemaps** تسمّي الـprimary لما يكون في واحد (هلق بتسمّي subdomain بيحوّل)
- **كشف wildcard record** — الحالة ١٦ الناقصة؛ بتنكشف بحلّ اسم غير موجود تحت الـzone
- **شدة التحذيرات** — `warnings: [String]` بتعرض كل إشي بنفس المربّع الكهرماني؛ `{code, severity, message}` بتخليها قابلة للترجمة كمان
- **تثبيت `VercelDomainProvider` end-to-end** — ربط → سجلات → verify → ACTIVE → خدمة

### P2 — «الدومين كمنتج» (ما بننصح فيها الآن)

شراء الدومينات، استضافة DNS، النقل، تحويل البريد، دومينات الأسواق. كلها بدها تكامل registrar وبتفتح التزامات تجارية (تجديدات، ICANN، نزاعات) مش بس شغل هندسي.

---

## 5. الحكم

**الباك إند متين.** ٢٨ ملف، ٢٨٥ اختبار للميزة، خمسة من تسع نتائج التقييم ما لمسته.

**الفجوة الحقيقية بالإيصال مش بالكشف.** بنينا كشف CAA وDNSSEC وproxy وAAAA بدقة تفوق توثيق شوبيفاي، وبعدين الواجهة بتخبّي الجواب جوّا لوحة مطوية بالضبط في الحالات اللي بنيناه عشانها. **الباك إند بيعرف ليش الشهادة فشلت؛ التاجر بيشوف علامة حمرا.**

لو في بند واحد يتنفّذ من كل الوثيقة: **طلّع `config.warnings` بره `DomainChecklist`.**
