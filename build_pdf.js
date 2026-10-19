const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const { marked } = require('marked');

const mdPath = path.join(__dirname, 'ZAYDAK_INVESTOR_AND_SYSTEM_OVERVIEW_AR.md');
const htmlPath = path.join(__dirname, 'ZAYDAK_INVESTOR_AND_SYSTEM_OVERVIEW_AR.html');
const pdfPath = path.join(__dirname, 'ZAYDAK_INVESTOR_AND_SYSTEM_OVERVIEW_AR.pdf');

const mdContent = fs.readFileSync(mdPath, 'utf-8');

// Custom renderer for marked
const renderer = new marked.Renderer();

renderer.code = function({ text, lang }) {
  const trimmed = text.trim();

  // 1. Omnichannel Discovery & Central Brain Architecture Card
  if (lang === 'mermaid' && trimmed.includes('DiscoveryChannels')) {
    return `
    <div class="custom-card visual-arch-card">
      <div class="card-header">
        <span class="card-badge">المعمارية الموحدة</span>
        <h4 class="card-title">منظومة القنوات الموحدة والعقل المركزي لمنصة زايدك</h4>
      </div>
      <div class="omni-grid">
        <div class="omni-col channels-col">
          <div class="col-badge">قنوات الاستحواذ والتفاعل</div>
          <div class="channel-card ig-card">
            <strong>📸 إنستغرام (Instagram)</strong>
            <span>المنشورات، الريلز، والرسائل الخاصة DMs مع ربط الوسائط بالمنتجات.</span>
          </div>
          <div class="channel-card wa-card">
            <strong>💬 واتساب (WhatsApp)</strong>
            <span>رقم المتجر المباشر عبر رمز QR وإدارة المتجر وبناء السلة التفاعلية.</span>
          </div>
          <div class="channel-card web-card">
            <strong>🌐 متجر الويب (Storefront)</strong>
            <span>واجهة المتجر العامة بـ Next.js 16، 6 قوالب حصرية، ونطاق مخصص.</span>
          </div>
        </div>
        <div class="omni-col core-col">
          <div class="col-badge">العقل المركزي الموحد (Zaydak Brain)</div>
          <div class="core-box">
            <div class="core-item">
              <strong>🤖 مساعد العملاء الموحد (CustomerBotService)</strong>
              <span>كتالوج مشترك، فحص مخزون لحظي، وفهم اللهجة الخليجية عبر كافة القنوات.</span>
            </div>
            <div class="core-item">
              <strong>⚡ وكيل التاجر الذكي (Vendor Sidekick - LangGraph)</strong>
              <span>~70 أداة لإدارة الكتالوج، الأسعار، المخزون، والتقارير المالية برسالة جوال.</span>
            </div>
            <div class="core-item">
              <strong>📊 النواة المؤسسية (NestJS Core API + Prisma 7)</strong>
              <span>دفتر أستاذ مالي بالهللات، إدارة مستودعات متعددة، وعزل صارم للمستأجرين.</span>
            </div>
          </div>
        </div>
        <div class="omni-col saudi-col">
          <div class="col-badge">البنية السعودية المدمجة</div>
          <div class="saudi-box">
            <div class="saudi-pill">💳 مدى & Apple Pay (ميسر / بي موب)</div>
            <div class="saudi-pill">📍 العنوان الوطني السعودي ورمز المبنى</div>
            <div class="saudi-pill">🚚 الشحن المجمّع OTO (سمسا، أرامكس، سبل)</div>
            <div class="saudi-pill">🏦 فحص الآيبان السعودي (mod-97)</div>
            <div class="saudi-pill">🧾 دفتر مالي متوافق مع الفوترة (ZATCA)</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // 2. Saudi Market Catalysts & Solution Card
  if (lang === 'mermaid' && trimmed.includes('MarketDrivers')) {
    return `
    <div class="custom-card market-drivers-card">
      <div class="card-header">
        <span class="card-badge">تحليل السوق والفرصة</span>
        <h4 class="card-title">مقارنة واقع السوق السعودي: الفجوة القائمة مقابل حل زايدك</h4>
      </div>
      <div class="drivers-grid">
        <div class="driver-col catalyst">
          <div class="d-header">🇸🇦 محركات السوق ورؤية 2030</div>
          <ul>
            <li><strong>سوق يتجاوز 60 مليار ريال:</strong> نمو سنوي مركب 18% باتجاه 100+ مليار بحلول 2030.</li>
            <li><strong>مجتمع غير نقدي:</strong> 70%+ من المشتريات عبر مدى و Apple Pay.</li>
            <li><strong>أعلى كثافة استخدام عالمياً:</strong> 85% من المشترين يتواصلون عبر واتساب وإنستغرام أثناء الشراء.</li>
            <li><strong>مستهدف المنشآت الصغيرة:</strong> رفع مساهمة المنشآت الصغيرة والمتوسطة لـ 35% من الناتج المحلي.</li>
          </ul>
        </div>
        <div class="driver-col bottleneck">
          <div class="d-header">⚠️ فجوة المنصات التقليدية (سلة / زد)</div>
          <ul>
            <li><strong>فصل المتجر عن السوشال ميديا:</strong> إجبار الزبون على الخروج وفتح روابط خارجية معقدة.</li>
            <li><strong>إرهاق الردود اليدوية:</strong> التاجر يقضي 5 ساعات يومياً في نسخ ولصق الأسعار في الشات.</li>
            <li><strong>ضياع 40% من المبيعات:</strong> تأخر الرد في إنستغرام وواتساب يؤدي لانسحاب العميل فوراً.</li>
            <li><strong>تكاليف إضافات باهظة:</strong> كل أداة تتطلب تطبيقاً خارجياً باشتراك مستقل.</li>
          </ul>
        </div>
        <div class="driver-col solution">
          <div class="d-header">✅ حل زايدك الثوري المدمج</div>
          <ul>
            <li><strong>أتمتة إنستغرام الحية:</strong> رد فوري على المنشورات والريلز وإرسال رابط المنتج في الـ DM.</li>
            <li><strong>إدارة كاملة من الجوال:</strong> تعديل الأسعار، متابعة المخزون، والتقارير عبر واتساب التاجر.</li>
            <li><strong>بناء السلة في الشات:</strong> تحويل المحادثة لطلب فوري برابط دفع سحري صالح 15 دقيقة.</li>
            <li><strong>جاهزية سعودية كاملة:</strong> دعم مدى، العنوان الوطني، وشحن OTO في صلب الكود.</li>
          </ul>
        </div>
      </div>
    </div>`;
  }

  // 3. Instagram Commerce via Zernio Architecture Card
  if (lang === 'mermaid' && (trimmed.includes('MerchantSetup') || trimmed.includes('InstagramEvents') || trimmed.includes('InstagramConnectionService'))) {
    return `
    <div class="custom-card ig-flow-card">
      <div class="card-header">
        <span class="card-badge">معمارية إنستغرام المتطورة</span>
        <h4 class="card-title">دورة حياة التجارة التفاعلية عبر إنستغرام (Zernio OAuth & AI Automation)</h4>
      </div>
      <div class="ig-steps-grid">
        <div class="ig-step">
          <div class="step-badge">المرحلة 01</div>
          <div class="step-title">ربط OAuth رسمي بنقرة واحدة</div>
          <div class="step-desc">التاجر يربط حسابه التجاري (Business/Creator) عبر Instagram Login دون الحاجة لإنشاء Meta App أو مراجعات أمنية معقدة. يتم عزل المعرفات بحماية مشفرة.</div>
        </div>
        <div class="ig-step">
          <div class="step-badge">المرحلة 02</div>
          <div class="step-title">معالجة الأحداث الحية وطوابير BullMQ</div>
          <div class="step-desc">استقبال أحداث التعليقات على المنشورات والريلز ورسائل DMs فورياً عبر Webhook موقّع بـ HMAC-SHA256، مع منع التكرار (Deduplication) التام في الذاكرة.</div>
        </div>
        <div class="ig-step">
          <div class="step-badge">المرحلة 03</div>
          <div class="step-title">ربط المنشورات بالمنتجات (Media-to-Product)</div>
          <div class="step-desc">استدعاء <code>CustomerBotService</code> بقناة إنستغرام؛ حيث يفهم النظام المنتج المعني في الصورة أو الريل بدقة (السعر، المخزون، والخيارات) دون أي تخمين أو هلوسة.</div>
        </div>
        <div class="ig-step">
          <div class="step-badge">المرحلة 04</div>
          <div class="step-title">التنفيذ المزدوج والتدخل البشري</div>
          <div class="step-desc">رد عام على التعليق لزيادة التفاعل + رسالة خاصة فورية برابط الشراء المباشر. إذا كتب موظف المتجر رداً يدوياً، يتوقف الذكاء الاصطناعي تلقائياً لمنع التداخل.</div>
        </div>
      </div>
    </div>`;
  }

  // 4. Conversational WhatsApp Flow Card
  if (lang === 'mermaid' && trimmed.includes('MerchantInteraction')) {
    return `
    <div class="custom-card conv-flow-card">
      <div class="card-header">
        <span class="card-badge">تجارة المحادثات الفائقة</span>
        <h4 class="card-title">دورة العمل التفاعلية عبر تطبيق واتساب (للتاجر والعميل)</h4>
      </div>
      <div class="conv-split">
        <div class="conv-side merchant-side">
          <div class="side-header">
            <span class="side-icon">📱</span>
            <strong>مسار التاجر: الإدارة والتحليل عبر واتساب</strong>
          </div>
          <div class="chat-bubble user-bubble">"ارفع سعر عطر مسك الورد 10% وأعطني تقرير أرباح اليوم"</div>
          <div class="chat-bubble bot-bubble">"تمت معاينة الأسعار: سيتم رفع السعر لـ 165 ر.س. أرباح اليوم الصافية بلغت 4,820 ر.س من 28 طلباً ناجحاً."</div>
          <div class="side-features">
            <span>• ~70 أداة إدارة في LangGraph</span>
            <span>• تشغيل تجريبي وموافقة قبل التعديل</span>
            <span>• استعلام مالي ومخزوني فوري</span>
          </div>
        </div>
        <div class="conv-side customer-side">
          <div class="side-header">
            <span class="side-icon">🛍️</span>
            <strong>مسار العميل: التسوق وبناء السلة برابط سحري</strong>
          </div>
          <div class="chat-bubble user-bubble">"أريد عباية حرير مقاس 54 مع التوصيل لحي الياسمين بالرياض"</div>
          <div class="chat-bubble bot-bubble">"أهلاً بك! المقاس متوفر. تم تجهيز سلتك مع عنوانك الوطني: اضغط هنا للدفع الآمن بـ Apple Pay (صالح 15 دقيقة)."</div>
          <div class="side-features">
            <span>• فحص لحظي للمخزون الحقيقي</span>
            <span>• حل العنوان الوطني السعودي تلقائياً</span>
            <span>• دفع سحري مشفر بضغطة زر واحدة</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  // 5. Monorepo & Backend Architecture Card
  if (lang === 'mermaid' && trimmed.includes('FrontendApps')) {
    return `
    <div class="custom-card mono-arch-card">
      <div class="card-header">
        <span class="card-badge">البنية الهندسية 2026</span>
        <h4 class="card-title">هندسة النظام البرمجية (Turborepo Monorepo Architecture)</h4>
      </div>
      <div class="mono-grid">
        <div class="mono-tier">
          <div class="tier-label">1. تطبيقات الواجهة الأمامية (Frontend Apps)</div>
          <div class="tier-items">
            <div class="tier-chip"><strong>apps/vendor:</strong> لوحة التاجر (Next.js 16 • React 19 • شريط الحفظ السياقي • ثنائي اللغة)</div>
            <div class="tier-chip"><strong>apps/admin:</strong> لوحة الإدارة (Next.js 16 • إدارة الاشتراكات وهامش ربح الـ AI بالهللة)</div>
            <div class="tier-chip"><strong>apps/storefront:</strong> متجر الويب (Next.js 16 • React Server Components • 6 قوالب حصرية)</div>
          </div>
        </div>
        <div class="mono-tier">
          <div class="tier-label">2. الحزم والمكتبات المشتركة (Shared Packages)</div>
          <div class="tier-items">
            <div class="tier-chip"><strong>packages/ui (@repo/ui):</strong> 38 مكون تصميمي متطور وموحد التصميم</div>
            <div class="tier-chip"><strong>packages/storefront-templates:</strong> 6 قوالب متاجر متفاعلة بالكامل</div>
          </div>
        </div>
        <div class="mono-tier">
          <div class="tier-label">3. الواجهة الخلفية والنواة البرمجية (Backend Standalone)</div>
          <div class="tier-items">
            <div class="tier-chip"><strong>NestJS 10 Core:</strong> ~80 موديول برمجي متكامل يغطي أدق عمليات التجارة</div>
            <div class="tier-chip"><strong>GraphQL Code-First (Apollo 5):</strong> واجهة بيانات سريعة وموثقة بالكامل</div>
            <div class="tier-chip"><strong>Prisma 7 ORM & LangGraph:</strong> محرك البيانات ووكلاء الذكاء الاصطناعي</div>
          </div>
        </div>
        <div class="mono-tier">
          <div class="tier-label">4. طبقة البيانات والبنية السحابية (Data & Cloud Tier)</div>
          <div class="tier-items">
            <div class="tier-chip"><strong>PostgreSQL + pgvector:</strong> قاعدة البيانات والبحث الدلالي باللغة الطبيعية</div>
            <div class="tier-chip"><strong>Redis + BullMQ:</strong> إدارة الطوابير، الأحداث، والمصادقة المؤقتة للأمان</div>
            <div class="tier-chip"><strong>BunnyCDN / S3:</strong> تسريع وتخزين الوسائط والصور الرقمية</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // 6. The 4 AI Surfaces Card
  if (lang === 'mermaid' && trimmed.includes('FourSurfaces')) {
    return `
    <div class="custom-card ai-surfaces-card">
      <div class="card-header">
        <span class="card-badge">تعدد أسطح الذكاء الاصطناعي</span>
        <h4 class="card-title">أسطح الذكاء الاصطناعي الأربعة المتمايزة في نظام زايدك</h4>
      </div>
      <div class="surfaces-grid">
        <div class="surface-box s1">
          <div class="s-badge">السطح 01</div>
          <div class="s-title">مساعد التاجر الذكي (Vendor Sidekick)</div>
          <div class="s-meta">واتساب • تيليجرام • لوحة التحكم</div>
          <div class="s-desc">~70 أداة في LangGraph StateGraph. السطح الوحيد المصرح له بتعديل بيانات المتجر، إدارة الأسعار، المخزون، والعمليات الجماعية مع نقاط توقف للموافقة البشرية.</div>
        </div>
        <div class="surface-box s2">
          <div class="s-badge">السطح 02</div>
          <div class="s-title">مساعد العملاء الموحد (Customer Bot)</div>
          <div class="s-meta">واتساب • إنستغرام • تيليجرام</div>
          <div class="s-desc">13 أداة لبناء السلة التفاعلية، حل العنوان الوطني السعودي، الردود الذكية على تعليقات المنشورات والريلز، وتوليد روابط الشراء السريعة المشفرة.</div>
        </div>
        <div class="surface-box s3">
          <div class="s-badge">السطح 03</div>
          <div class="s-title">مساعد متجر الويب (Storefront Assistant)</div>
          <div class="s-meta">المتجر الإلكتروني العام (RSC)</div>
          <div class="s-desc">نافذة تفاعلية في متجر الويب تشارك نفس الكتالوج الموحد، مع 11 أداة متخصصة لخدمة الزبون المسجل (تتبع الشحنات، إعادة الطلب، وقوائم الأمنيات).</div>
        </div>
        <div class="surface-box s4">
          <div class="s-badge">السطح 04</div>
          <div class="s-title">استوديو وسائط الـ AI (Media Studio)</div>
          <div class="s-meta">لوحة تحكم التاجر</div>
          <div class="s-desc">توليد جلسات تصوير افتراضية، تفريغ الصور، رفع الدقة، وقوالب المناسبات السعودية (اليوم الوطني، رمضان، الأعياد) مع توليد أوصاف Alt Text دقيقة للـ SEO.</div>
        </div>
      </div>
    </div>`;
  }

  // 7. Revenue Engines Breakdown Card
  if (lang === 'mermaid' && trimmed.includes('RevenueEngine')) {
    return `
    <div class="custom-card revenue-card">
      <div class="card-header">
        <span class="card-badge">النموذج المالي ثلاثي الأبعاد</span>
        <h4 class="card-title">محركات الإيرادات والتدفقات النقدية المتكررة للمنصة</h4>
      </div>
      <div class="rev-grid">
        <div class="rev-col">
          <div class="rev-icon">💼</div>
          <div class="rev-title">1. اشتراكات SaaS متكررة (MRR / ARR)</div>
          <div class="rev-desc">5 باقات متدرجة مسعرة بالريال السعودي (من المجانية وحتى باقة بلس بـ 4,999 ر.س/شهرياً) توفر دخلاً متكرراً مستقراً مع ميزة الدفع السنوي (10 أشهر).</div>
        </div>
        <div class="rev-col">
          <div class="rev-icon">📈</div>
          <div class="rev-title">2. عمولة مبيعات المنصة (Take Rate)</div>
          <div class="rev-desc">نسبة عمولة مبرمجة في صميم مسار الدفع (1.5% إلى 2.5% من إجمالي مبيعات التجار GMV) تُقتطع لحظياً وآلياً قبل إيداع مستحقات التاجر للسحب.</div>
        </div>
        <div class="rev-col">
          <div class="rev-icon">⚡</div>
          <div class="rev-title">3. هوامش استهلاك الـ AI والوسائط</div>
          <div class="rev-desc">تتبع تكلفة كل استدعاء ذكاء اصطناعي بالهللة والسنت وتسجيله في دفتر أستاذ التكلفة، وإعادة بيع باقات الردود الإضافية وتوليد الصور بهامش ربح صافٍ للمنصة 40-60%.</div>
        </div>
      </div>
    </div>`;
  }

  // 8. Replace Mermaid Pie Chart with a stunning, prestigious HTML/CSS breakdown
  if (lang === 'mermaid' && trimmed.startsWith('pie title')) {
    return `
    <div class="custom-card custom-chart-card">
      <div class="chart-header">
        <span class="chart-badge">تحليل السوق والشرائح</span>
        <h4 class="chart-title">الشرائح المستهدفة في سوق التجارة الإلكترونية السعودي والخليجي</h4>
      </div>
      <div class="chart-bars">
        <div class="chart-row">
          <div class="row-meta">
            <span class="row-label">تجار السوشال ميديا، إنستغرام وواتساب (بدون نظام أتمتة)</span>
            <span class="row-pct">45%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width: 45%; background: linear-gradient(90deg, #059669, #10b981);"></div></div>
        </div>
        <div class="chart-row">
          <div class="row-meta">
            <span class="row-label">تجار المنصات التقليدية (سلة / زد / شوبيفاي)</span>
            <span class="row-pct">25%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width: 25%; background: linear-gradient(90deg, #0284c7, #38bdf8);"></div></div>
        </div>
        <div class="chart-row">
          <div class="row-meta">
            <span class="row-label">التجار الناشئون وأصحاب وثائق العمل الحر والأسر المنتجة</span>
            <span class="row-pct">15%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width: 15%; background: linear-gradient(90deg, #8b5cf6, #a78bfa);"></div></div>
        </div>
        <div class="chart-row">
          <div class="row-meta">
            <span class="row-label">العلامات التجارية والشركات المتوسطة (Multi-Warehouse)</span>
            <span class="row-pct">15%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width: 15%; background: linear-gradient(90deg, #f59e0b, #fbbf24);"></div></div>
        </div>
      </div>
    </div>`;
  }

  // 9. Replace Gantt chart with a sleek, readable executive Roadmap timeline
  if (lang === 'mermaid' && trimmed.startsWith('gantt')) {
    return `
    <div class="custom-card custom-roadmap-card">
      <div class="roadmap-header">
        <span class="chart-badge">خطة العمل والتشغيل</span>
        <h4 class="chart-title">خطة الإطلاق التجاري والتشغيلي في السوق السعودي (10 أسابيع)</h4>
      </div>
      <div class="timeline-phases">
        <div class="phase-item">
          <div class="phase-number">01</div>
          <div class="phase-body">
            <div class="phase-title">بوابات الدفع السعودية (مدى وآبل باي)</div>
            <div class="phase-duration">الأسابيع 1 - 3 (21 يوم)</div>
            <div class="phase-desc">ربط بوابات الدفع المحلية مثل Moyasar أو Paymob لتفعيل شبكة "مدى" و Apple Pay وتفعيل اقتطاع عمولة المنصة المبرمجة.</div>
          </div>
        </div>
        <div class="phase-item">
          <div class="phase-number">02</div>
          <div class="phase-body">
            <div class="phase-title">البنية التحتية والتهيئة السحابية للإنتاج</div>
            <div class="phase-duration">الأسابيع 2 - 4 (14 يوم)</div>
            <div class="phase-desc">تفعيل اشتراك Redis الإنتاجي، ضبط خوادم الواجهة الخلفية، تدوير المفاتيح وتفعيل مزود رسائل SMS والبريد المعتمد في السعودية.</div>
          </div>
        </div>
        <div class="phase-item">
          <div class="phase-number">03</div>
          <div class="phase-body">
            <div class="phase-title">الإطلاق التجريبي المحروس (Closed Beta)</div>
            <div class="phase-duration">الأسابيع 5 - 7 (14 يوم)</div>
            <div class="phase-desc">تشغيل 20 متجراً سعودياً حقيقياً مختاراً بعناية لمراقبة استهلاك المساعد الذكي وخدمات الشحن والمدفوعات على أرض الواقع.</div>
          </div>
        </div>
        <div class="phase-item">
          <div class="phase-number">04</div>
          <div class="phase-body">
            <div class="phase-title">الإطلاق التجاري الكامل وحملة التسويق</div>
            <div class="phase-duration">الأسابيع 8 - 10 (14 يوم)</div>
            <div class="phase-desc">فتح التسجيل العام للتجار، تدشين الحملات الإعلانية الموجهة لتجار إنستغرام وواتساب، وبدء تحصيل الاشتراكات والعمولات.</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // 10. Replace flowchart TD (the 6-layer security framework) with an ultra-clean executive cards stack
  if (lang === 'mermaid' && trimmed.includes('Approval Interrupts') && trimmed.includes('Redis')) {
    return `
    <div class="custom-card security-layers-card">
      <div class="chart-header">
        <span class="chart-badge">الأمان المؤسسي المشدد</span>
        <h4 class="chart-title">إطار حماية وأمان الذكاء الاصطناعي متعدد الطبقات (The 6-Layer Security Framework)</h4>
      </div>
      <div class="layers-grid">
        <div class="layer-step">
          <span class="layer-num">1</span>
          <div class="layer-content">
            <strong>الطبقة الأولى: الهوية والنطاق الصارم</strong>
            <span>عزل ترويسات X-SHOP والتحقق الصارم من ملكية المتجر عبر JWT المشفر.</span>
          </div>
        </div>
        <div class="layer-step">
          <span class="layer-num">2</span>
          <div class="layer-content">
            <strong>الطبقة الثانية: بوابات الصلاحية والباقة</strong>
            <span>فحص صلاحية الأداة برمجياً بحسب رخصة باقة المتجر (Plan Entitlements).</span>
          </div>
        </div>
        <div class="layer-step">
          <span class="layer-num">3</span>
          <div class="layer-content">
            <strong>الطبقة الثالثة: قيود القنوات (Channel Tool Policy)</strong>
            <span>قوائم بيضاء تستبعد العمليات الحساسة والملفات الضخمة من واتساب وإنستغرام.</span>
          </div>
        </div>
        <div class="layer-step">
          <span class="layer-num">4</span>
          <div class="layer-content">
            <strong>الطبقة الرابعة: نقاط التوقف البشرية (Approval Interrupts)</strong>
            <span>تعليق التنفيذ البرمجي في LangGraph وطلب تأكيد صريح (1 أو 2) قبل أي تعديل جماعي.</span>
          </div>
        </div>
        <div class="layer-step">
          <span class="layer-num">5</span>
          <div class="layer-content">
            <strong>الطبقة الخامسة: الحذف بمصادقة مرحلية (Two-Phase)</strong>
            <span>إصدار رمز مؤقت مشفر في Redis صالح لـ 60 ثانية لحماية المنتجات من الحذف العرضي.</span>
          </div>
        </div>
        <div class="layer-step">
          <span class="layer-num">6</span>
          <div class="layer-content">
            <strong>الطبقة السادسة: وساطة النماذج (Form Mediation)</strong>
            <span>تجهيز الحقول وتعبئة النموذج للتاجر ليكون ضغط زر الحفظ هو الموافقة النهائية.</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  if (lang === 'mermaid') {
    return `<div class="mermaid-box"><pre class="mermaid">${text}</pre></div>`;
  }
  return `<pre class="code-block"><code class="language-${lang || 'text'}">${text}</code></pre>`;
};

renderer.blockquote = function({ text }) {
  let alertType = 'note';
  let cleanText = text;

  if (cleanText.includes('[!NOTE]')) {
    alertType = 'note';
    cleanText = cleanText.replace(/\[!NOTE\]/g, '');
  } else if (cleanText.includes('[!TIP]')) {
    alertType = 'tip';
    cleanText = cleanText.replace(/\[!TIP\]/g, '');
  } else if (cleanText.includes('[!IMPORTANT]')) {
    alertType = 'important';
    cleanText = cleanText.replace(/\[!IMPORTANT\]/g, '');
  } else if (cleanText.includes('[!WARNING]')) {
    alertType = 'warning';
    cleanText = cleanText.replace(/\[!WARNING\]/g, '');
  }

  // Convert markdown bold inside blockquotes
  cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  return `<div class="callout callout-${alertType}">${cleanText}</div>`;
};

marked.setOptions({
  renderer,
  gfm: true,
  breaks: false
});

const bodyHtml = marked.parse(mdContent);

const htmlDocument = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>زايدك (Zaydak) — الملف الاستثماري والتقني الشامل</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.6;
      font-size: 10pt;
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
    }

    /* Cover Page */
    .cover-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 88vh;
      padding: 40px 30px;
      border: 2px solid #0f172a;
      border-radius: 14px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      margin-bottom: 25px;
    }

    .cover-badge-group {
      display: flex;
      gap: 10px;
      margin-bottom: 22px;
      flex-wrap: wrap;
    }

    .cover-badge {
      display: inline-block;
      background-color: #0f172a;
      color: #ffffff;
      font-size: 8.5pt;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
    }

    .cover-badge-saudi {
      background: linear-gradient(90deg, #059669, #10b981);
      color: #ffffff;
    }

    .cover-title {
      font-size: 34pt;
      font-weight: 900;
      color: #0f172a;
      margin: 0 0 8px 0;
      line-height: 1.2;
    }

    .cover-subtitle {
      font-size: 15pt;
      font-weight: 700;
      color: #059669;
      margin: 0 0 20px 0;
      line-height: 1.4;
    }

    .cover-desc {
      font-size: 10.5pt;
      color: #475569;
      max-width: 680px;
      line-height: 1.7;
      margin-bottom: 30px;
    }

    .cover-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-top: 15px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 14px 10px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .stat-number {
      font-size: 17pt;
      font-weight: 900;
      color: #0f172a;
      display: block;
      margin-bottom: 3px;
    }

    .stat-label {
      font-size: 8pt;
      font-weight: 600;
      color: #64748b;
    }

    .cover-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
      color: #64748b;
      margin-top: auto;
    }

    /* Headings */
    h1 {
      font-size: 17pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-top: 32px;
      margin-bottom: 16px;
      page-break-after: avoid;
    }

    h2 {
      font-size: 13pt;
      font-weight: 800;
      color: #1e293b;
      border-right: 4px solid #059669;
      padding-right: 12px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 11pt;
      font-weight: 700;
      color: #334155;
      margin-top: 18px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    p {
      margin-top: 0;
      margin-bottom: 11px;
      text-align: justify;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 12px;
      padding-right: 22px;
    }

    li {
      margin-bottom: 5px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #cbd5e1;
    }

    thead tr {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 700;
    }

    th {
      padding: 9px 12px;
      text-align: right;
      border: 1px solid #334155;
      font-size: 8pt;
    }

    td {
      padding: 7px 12px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }

    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }

    /* Custom Visual Cards Base */
    .custom-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 18px 0;
      page-break-inside: avoid;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
    }

    .card-header, .chart-header, .roadmap-header {
      margin-bottom: 14px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
    }

    .card-badge, .chart-badge {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
      padding: 3px 10px;
      border-radius: 9999px;
      margin-bottom: 5px;
    }

    .card-title, .chart-title {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }

    /* 1. Omnichannel Card */
    .omni-grid {
      display: grid;
      grid-template-columns: 1fr 1.3fr 1fr;
      gap: 12px;
    }

    .col-badge {
      font-size: 8pt;
      font-weight: 700;
      color: #475569;
      margin-bottom: 8px;
      text-align: center;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 6px;
    }

    .channels-col, .core-col, .saudi-col {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .channel-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 7.5pt;
      line-height: 1.4;
    }

    .channel-card strong {
      display: block;
      color: #0f172a;
      font-size: 8pt;
      margin-bottom: 2px;
    }

    .ig-card { border-right: 3px solid #e1306c; }
    .wa-card { border-right: 3px solid #25d366; }
    .web-card { border-right: 3px solid #0284c7; }

    .core-box {
      background: #0f172a;
      color: #f8fafc;
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
    }

    .core-item strong {
      display: block;
      color: #38bdf8;
      font-size: 8pt;
      margin-bottom: 2px;
    }

    .core-item span {
      font-size: 7.5pt;
      color: #cbd5e1;
      line-height: 1.3;
      display: block;
    }

    .saudi-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .saudi-pill {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 7.5pt;
      font-weight: 700;
    }

    /* 2. Market Drivers Card */
    .drivers-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .driver-col {
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 7.5pt;
    }

    .catalyst { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .bottleneck { background: #fef2f2; border: 1px solid #fecaca; }
    .solution { background: #eff6ff; border: 1px solid #bfdbfe; }

    .d-header {
      font-weight: 800;
      font-size: 8.5pt;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }

    .catalyst .d-header { color: #166534; }
    .bottleneck .d-header { color: #991b1b; }
    .solution .d-header { color: #1e40af; }

    .driver-col ul {
      padding-right: 14px;
      margin: 0;
    }

    .driver-col li {
      margin-bottom: 4px;
      line-height: 1.4;
    }

    /* 3. Instagram Steps Grid */
    .ig-steps-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .ig-step {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      position: relative;
    }

    .step-badge {
      font-size: 7pt;
      font-weight: 800;
      color: #e1306c;
      background: #fdf2f8;
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 4px;
    }

    .step-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 3px;
    }

    .step-desc {
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.4;
    }

    /* 4. Conversational Split */
    .conv-split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .conv-side {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
    }

    .side-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 8.5pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
    }

    .chat-bubble {
      padding: 7px 10px;
      border-radius: 8px;
      font-size: 7.5pt;
      line-height: 1.4;
      margin-bottom: 6px;
    }

    .user-bubble {
      background: #e2e8f0;
      color: #1e293b;
      border-top-right-radius: 0;
    }

    .bot-bubble {
      background: #059669;
      color: #ffffff;
      border-top-left-radius: 0;
    }

    .side-features {
      margin-top: 8px;
      font-size: 7pt;
      color: #64748b;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* 5. Monorepo Tiers */
    .mono-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mono-tier {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
    }

    .tier-label {
      font-size: 8pt;
      font-weight: 800;
      color: #059669;
      margin-bottom: 4px;
    }

    .tier-items {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tier-chip {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 7.5pt;
      color: #334155;
    }

    /* 6. AI Surfaces Grid */
    .surfaces-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .surface-box {
      border-radius: 8px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .s-badge {
      font-size: 7pt;
      font-weight: 800;
      color: #0284c7;
      background: #f0f9ff;
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      margin-bottom: 3px;
    }

    .s-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .s-meta {
      font-size: 7pt;
      font-weight: 700;
      color: #059669;
      margin-bottom: 4px;
    }

    .s-desc {
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.4;
    }

    /* 7. Revenue Grid */
    .rev-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .rev-col {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }

    .rev-icon {
      font-size: 16pt;
      margin-bottom: 4px;
    }

    .rev-title {
      font-size: 8pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .rev-desc {
      font-size: 7pt;
      color: #64748b;
      line-height: 1.35;
    }

    /* Chart Bars & Roadmap */
    .chart-bars {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .chart-row {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .row-meta {
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
    }

    .row-pct {
      color: #0f172a;
      font-weight: 800;
    }

    .bar-track {
      width: 100%;
      height: 9px;
      background: #f1f5f9;
      border-radius: 9999px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 9999px;
    }

    .timeline-phases {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .phase-item {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 8px 10px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .phase-number {
      background: #0f172a;
      color: #ffffff;
      font-weight: 900;
      font-size: 10pt;
      padding: 4px 10px;
      border-radius: 6px;
      min-width: 34px;
      text-align: center;
    }

    .phase-body { flex: 1; }
    .phase-title {
      font-size: 9pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .phase-duration {
      font-size: 7.5pt;
      font-weight: 700;
      color: #059669;
      margin-bottom: 3px;
    }

    .phase-desc {
      font-size: 8pt;
      color: #475569;
      line-height: 1.4;
    }

    /* Security Layers Grid */
    .layers-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .layer-step {
      display: flex;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px;
      align-items: center;
    }

    .layer-num {
      background: #059669;
      color: #ffffff;
      font-weight: 800;
      font-size: 9pt;
      width: 26px;
      height: 26px;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .layer-content {
      display: flex;
      flex-direction: column;
      font-size: 7.5pt;
      line-height: 1.35;
    }

    .layer-content strong {
      font-size: 8pt;
      color: #0f172a;
      margin-bottom: 1px;
    }

    /* Code Blocks */
    .code-block {
      background-color: #0f172a;
      color: #e2e8f0;
      padding: 10px 14px;
      border-radius: 8px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 8pt;
      direction: ltr;
      text-align: left;
      overflow-x: auto;
      margin: 14px 0;
      page-break-inside: avoid;
    }

    /* Callout & Quotes */
    .callout {
      border-right: 4px solid #059669;
      background-color: #f0fdf4;
      padding: 10px 14px;
      border-radius: 6px;
      margin: 12px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    .callout-warning {
      border-right-color: #d97706;
      background-color: #fffbeb;
    }

    .callout-important {
      border-right-color: #dc2626;
      background-color: #fef2f2;
    }

    .callout-note {
      border-right-color: #2563eb;
      background-color: #eff6ff;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }

    strong {
      color: #0f172a;
      font-weight: 700;
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-badge-group">
      <span class="cover-badge">وثيقة استثمارية سرية — مخصصة للمستثمرين والصناديق الجريئة</span>
      <span class="cover-badge cover-badge-saudi">🇸🇦 مخصصة للسوق السعودي — متوافقة مع رؤية 2030</span>
    </div>
    <div class="cover-title">زايدك (Zaydak)</div>
    <div class="cover-subtitle">منظومة التجارة التفاعلية والاجتماعية الشاملة (Social & Conversational Commerce)</div>
    <div class="cover-desc">
      منصة تجارة سحابية متعددة المستأجرين مهندسة من الصفر للسوق السعودي والخليجي — تجمع في عقل مركزي موحد بين أتمتة إنستغرام الذكية (المنشورات، الريلز، والرسائل الخاصة DMs)، وإدارة المتجر بالكامل ومساعد الشراء عبر واتساب، مع متجر ويب فائق السرعة وتوافق تام مع البنية التحتية السعودية (مدى، Apple Pay، العنوان الوطني السعودي، ومجمع الشحن OTO).
    </div>

    <div class="cover-grid">
      <div class="stat-card">
        <span class="stat-number">450+</span>
        <span class="stat-label">قدرة تشغيلية مبنية</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">9,802</span>
        <span class="stat-label">اختبار برمجي آلي ناجح</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">3 قنوات</span>
        <span class="stat-label">إنستغرام • واتساب • تيليجرام</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">~70</span>
        <span class="stat-label">أداة ذكاء اصطناعي للتاجر</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">80+</span>
        <span class="stat-label">موديول في الواجهة الخلفية</span>
      </div>
    </div>

    <div class="cover-footer">
      <div><strong>النطاق:</strong> مراجعة معمارية وتجارية وهندسية مدققة للكود المصدري لعام 2026</div>
      <div><strong>التاريخ:</strong> أكتوبر 2026</div>
    </div>
  </div>

  <!-- Document Body -->
  <div class="document-content">
    ${bodyHtml}
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      fontFamily: 'Cairo, sans-serif',
      flowchart: { curve: 'basis' }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(htmlPath, htmlDocument, 'utf-8');
console.log('HTML updated successfully at:', htmlPath);

// Execute Chrome to convert to PDF
async function convertToPdf() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const userDataDir = path.join(os.tmpdir(), "chrome_pdf_export_" + Date.now());

  console.log('Starting Chrome headless for PDF generation...');

  const args = [
    '--headless=new',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    `--print-to-pdf=${pdfPath}`,
    `file:///${htmlPath.replace(/\\\\/g, '/')}`
  ];

  const chromeProc = spawn(chromePath, args);

  chromeProc.on('close', (code) => {
    console.log(`Chrome finished with exit code ${code}`);
    if (fs.existsSync(pdfPath)) {
      const stats = fs.statSync(pdfPath);
      console.log(`PDF successfully created! Size: ${(stats.size / 1024).toFixed(1)} KB`);
    } else {
      console.error('PDF file was not found!');
    }
  });
}

convertToPdf().catch(err => {
  console.error('Conversion error:', err);
});
