# LangSmith vs Langfuse — قرار Zaydak

**Last updated:** 2026-09-19  
**القرار المقترح:** **Langfuse** لمرحلة Tracing + Cost Tracking (ثم التوسيع لاحقاً).

هذا ملف قرار، ليس دليلاً تشغيلياً. لا يوجد تكامل مطبّق في الـ Backend بعد.

---

## ماذا عندنا فعلياً في النظام؟

| السطح | التقنية | ملاحظة |
|---|---|---|
| Vendor Sidekick | LangGraph + tools | أكثر مسار معقّد (خطوات كثيرة) |
| Customer bot (WA/TG) | LangChain tools | حجم عالي عبر متاجر كثيرة |
| Negotiation phrasing | LangChain `model.invoke` | مسار واضح وسهل للاختبار |
| Storefront assistant | LangChain عبر customer-bot | |
| Content / editor / segments | LangChain ChatOpenAI | |
| Image / Replicate | خارج LangChain | |
| Streaming Sidekick | جزء منه `fetch` خام | ليس كله عبر LangChain callbacks |
| الفوترة | `UsageTracker` + `usage_events` + خطط | موجودة مسبقاً — المراقبة شيء منفصل |

أيضاً: multi-tenant (`shopId`)، قنوات عربية/إنجليزية، محادثات زبائن حساسة، وSentry للأخطاء العامة (ليس بديلاً عن LLM tracing).

---

## مقارنة سريعة على مقاس المشروع

| المعيار | Langfuse | LangSmith | الأنسب لنا؟ |
|---|---|---|---|
| الترخيص | MIT، مفتوح | مغلق | Langfuse |
| Self-host | مجاني كامل المزايا تقريباً | Enterprise فقط | Langfuse (خصوصية المتاجر) |
| التكلفة عند الحجم | رخيصة نسبياً (units) | مقاعد + traces غالية مع النمو | Langfuse (marketplace = حجم) |
| Free tier | ~50k units | ~5k traces / مقعد واحد | Langfuse للتجربة |
| تكامل LangChain/LangGraph | جيد (CallbackHandler) | الأفضل (first-party) | LangSmith بفارق بسيط |
| مسارات غير LangChain (Replicate / fetch) | طبيعي (OTEL) | أضعف / أكثر عمل | Langfuse |
| Cost + tokens في الـ UI | قوي | قوي | تعادل |
| Prompt hub / evals الجاهزة | موجود، أقل “مصقول” | أقوى كمنتج جاهز | LangSmith إذا صار التقييم أولوية |
| Vendor lock-in | منخفض | أعلى (منظومة LangChain) | Langfuse |

---

## الحكم

### اختر Langfuse إذا (وهذا وضعنا)

1. **حجم الإنتاج عبر متاجر كثيرة** — كل محادثة negotiation / bot = traces؛ فاتورة LangSmith تكبر بسرعة.
2. **بيانات زبائن ومتاجر** — محادثات تفاوض وواتساب؛ خيار Cloud EU أو self-host لاحقاً بدون Enterprise.
3. **الهدف الحالي Phase 1 = Tracing + Cost** — هذا لبّ Langfuse، بدون الحاجة لكل منتج LangSmith.
4. **ستاك مختلط** — عندنا LangGraph قوي، لكن أيضاً OpenRouter/Groq وReplicate وfetch؛ نحتاج طبقة محايدة.
5. **الفوترة عندنا جاهزة** — نحتاج مراقبة تشغيلية رخيصة بجانب `usage_events`، لا منصة فوترة ثانية غالية.

### اختر LangSmith فقط إذا

- الأولوية القصوى = debug عميق لـ Sidekick/LangGraph بأقل كود، والحجم قليل، والفريق مرتاح لبيانات المحادثات على Cloud LangChain، ولا يهم self-host قريب.

---

## توصية التنفيذ (بعد الموافقة)

1. **Langfuse Cloud** لمشروع `Zaydak AI Observability` (بدون Docker الآن).
2. أول مسار: **Negotiation** (واضح وسهل التحقق من الـ Trace + التكلفة).
3. بعدها: Vendor Agent ثم Customer bot.
4. سياسة بيانات: metadata (`shopId`, `feature`, `sessionId`, `model`, tokens/cost) دائماً؛ نص المحادثة فقط مع `LANGFUSE_TRACE_CONTENT=1` أثناء الاختبار.

لا ترسل Secret Key في الشات أو Git — فقط في env الـ Backend.

---

## خلاصة جملة واحدة

**للمنصة الحالية: Langfuse أنسب من LangSmith** — تكلفة وحجم وخصوصية وحياد الستاك؛ LangSmith يفوز فقط إذا أردتم أقصى راحة LangGraph مقابل سعر وlock-in أعلى.
