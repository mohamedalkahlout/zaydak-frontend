# P03-T03 — نسخة احتياطية واستعادة (تمرين محلي)

**Last updated:** 2026-09-16  
**البيئة:** Docker Compose `zaydak` فقط (`zaydak-postgres` على `localhost:5432` / قاعدة `zaydak`).  
**إنتاج / staging:** **محجوب** — لا دخول Neon/Render؛ لا يُنفَّذ تمرين استعادة إنتاج في هذه الجولة.

## الإجراء

```powershell
# من back-end/ (أو أي مسار؛ الملفات تحت back-end/.tmp و gitignored)
docker exec zaydak-postgres pg_dump -U postgres -Fc zaydak -f /tmp/p03.dump
docker cp zaydak-postgres:/tmp/p03.dump back-end/.tmp/zaydak-p03-t03-20260916.dump

docker exec zaydak-postgres psql -U postgres -c "CREATE DATABASE zaydak_p03_restore_check;"
docker cp back-end/.tmp/zaydak-p03-t03-20260916.dump zaydak-postgres:/tmp/p03.dump
docker exec zaydak-postgres pg_restore -U postgres -d zaydak_p03_restore_check --no-owner --no-acl /tmp/p03.dump

# تحقق ثم تنظيف
docker exec zaydak-postgres psql -U postgres -d zaydak_p03_restore_check -c "SELECT count(*) FROM users;"
docker exec zaydak-postgres psql -U postgres -c "DROP DATABASE zaydak_p03_restore_check;"
```

لا تُستعاد فوق قاعدة `zaydak` الحية في التمرين — الهدف قاعدة رمي معزولة.

## القياسات (2026-09-16)

| المقياس | القيمة | ملاحظات |
|---|---|---|
| حجم الـdump | 2 346 460 بايت (~2.2 MB) | `pg_dump -Fc` |
| زمن الـsnapshot | **3.66 s** | من أمر dump حتى اكتمال النسخ للمضيف |
| زمن الاستعادة إلى قاعدة فارغة | **20.31 s** | `pg_restore` فقط |
| تحقق الصفوف | 182 جدولًا عامًا، 68 مستخدمًا، 8 تكاملات | يطابق توقعات النسخة المحلية |
| هدف RPO (D08) | &lt; 15 دقيقة | يتطلب نسخًا دوريًا على المزود — غير مفعّل محليًا كجدولة |
| هدف RTO (D08) | &lt; 30 دقيقة | استعادة DB المحلية ~20s؛ RTO الكامل = استعادة + إعادة تشغيل API + تحقق `/ready` |
| تمرين إنتاج | **محجوب** | بلا وحدة تحكم Neon/Render |

ملف الدليل: `back-end/.tmp/zaydak-p03-t03-20260916.dump` (gitignored).

## ما لا يغطيه هذا التمرين

- ملفات BunnyCDN / التخزين الخارجي ومفاتيح فك النسخ القديمة (يحتاج جرد P01 + مزود التخزين).
- PITR أو snapshots المزوّد على Neon.
- تنبيه فشل النسخ ومالكه على الإنتاج.
- Redis: الطوابير تُفقد عند استعادة DB وحدها؛ لا snapshot Redis في هذا التمرين.

## إجراء عند فشل استعادة `zaydak` نفسها

1. أوقف `zaydak-api`.
2. استعد الـdump على قاعدة `zaydak` (بعد أخذ dump طارئ إن أمكن).
3. أعد التشغيل وتحقق `GET /health` و`GET /ready`.
