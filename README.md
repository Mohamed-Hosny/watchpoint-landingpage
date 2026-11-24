# Watch Point — Static Site + Local Admin (Cloudflare Pages Ready)

مشروع موقع **Watch Point** للأنظمة الأمنية وكاميرات المراقبة، مُقسّم إلى مجلدين مستقلين وفق بنية **(Static Site + Local Admin)**:

- **`public-site/`** — الموقع العام الثابت فقط (HTML/CSS/JS، الكتالوج `catalog/`، الصور والخطوط `assets/` بما فيها `assets/images/uploads/`، ملفات SEO، `404.html`، و`_headers`). هذا هو المجلد الوحيد الذي يُنشر على **Cloudflare Pages**.
- **`local-admin/`** — لوحة التحكم والباك إند المحلي (`server.mjs`, `auth.mjs`, `store.mjs`, `views.mjs`, `data/`, `backups/`, `public/`, `tools/`). تعمل محليًا على جهازك فقط ومستبعدة تمامًا من Git عبر `.gitignore`.

---

## دورة العمل اليومية (Workflow)

1. شغّل لوحة التحكم محليًا بدبل كليك على:
   ```text
   start-admin.bat
   ```
   (أو من الطرفية: `node local-admin/server.mjs --port=8123`)
2. افتح `http://127.0.0.1:8123/admin` وأضف/عدّل المنتجات والصور والباقات والإعدادات.
3. تقوم لوحة التحكم تلقائيًا (وعند الضغط على **«نشر التغييرات»**) بتحديث ملفات `public-site/` محليًا (`js/data.js`, `js/config.js`, `catalog/*.html`, `catalog/catalog.json`, `assets/images/uploads/`, `sitemap.xml`, `robots.txt`, `llms.txt`, `404.html`).
4. عاين الموقع محليًا على `http://127.0.0.1:8123/` (أو عبر `start-watchpoint.bat`).
5. ارفع التحديثات إلى GitHub لتُنشر تلقائيًا على Cloudflare Pages بدبل كليك على:
   ```text
   publish-online.bat
   ```
   *(أو يدويًا عبر `git add public-site && git commit -m "Update catalog" && git push`).*

---

## ملفات التشغيل السريع

| الملف | الوظيفة |
| --- | --- |
| `start-admin.bat` | يشغّل لوحة التحكم (`local-admin/`) + معاينة `public-site/` عبر Node.js ويفتح `/admin` |
| `publish-online.bat` | يرفع تعديلات `public-site/` إلى GitHub بضغطة واحدة لتتحدث تلقائيًا على Cloudflare Pages |
| `start-watchpoint.bat` | يشغّل معاينة ثابتة لمجلد `public-site/` فقط (Python أو `npx serve`) |

---

## إعدادات النشر على Cloudflare Pages

عند ربط المستودع (GitHub Repository) بـ **Cloudflare Pages**:

| الإعداد | القيمة |
| --- | --- |
| **Framework preset** | `None` |
| **Build command** | *(اتركه فارغًا)* |
| **Build output directory** | `public-site` |
| **Root directory** | *(اتركه فارغًا — جذر المستودع)* |

> **مهم بعد أول إطلاق:** بعد الحصول على رابط موقعك من Cloudflare Pages (أو ربط نطاقك الخاص)، افتح لوحة التحكم المحلية ← **بيانات الموقع** ← ضع الرابط الكامل في **رابط الموقع** (مثل `https://watchpoint.pages.dev` أو دومينك الخاص) ثم اضغط **«نشر التغييرات»** وارفعه بـ `git push` لتحديث `sitemap.xml` و`robots.txt` و`llms.txt` وروابط Canonical تلقائيًا.

---

## النسخ الاحتياطي والأمان

- بيانات لوحة التحكم كلها داخل `local-admin/data/` (`store.json`, `auth.json`, `backups/`) — احتفظ بنسخة احتياطية منها محليًا لأنها غير مرفوعة إلى GitHub لحماية خصوصيتك وأمانك.
- ملف `.gitignore` يمنع رفع `local-admin/` وأي ملفات `auth.json` أو `store.json` أو `backups/`، بينما يبقي `public-site/` وداخله `public-site/assets/images/uploads/` متتبَّعة في Git.
