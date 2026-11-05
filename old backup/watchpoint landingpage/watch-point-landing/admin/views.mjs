/* ==========================================================================
   Watch Point Admin — server-rendered views (Arabic / RTL)
   ========================================================================== */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const attr = (value) => escapeHtml(value);
const checked = (value) => (value ? "checked" : "");
const selected = (a, b) => (String(a) === String(b) ? "selected" : "");
const imgSrc = (value) => {
  if (!value) return "/assets/images/brand-mark.webp";
  if (/^(https?:|data:)/i.test(value)) return value;
  return "/" + String(value).replace(/^\.?\//, "");
};

const MESSAGES = {
  saved: ["ok", "تم الحفظ. التغييرات محفوظة في لوحة التحكم — اضغط «نشر التغييرات» لتظهر على الموقع."],
  deleted: ["ok", "تم الحذف من لوحة التحكم. اضغط «نشر التغييرات» لتحديث الموقع."],
  settings: ["ok", "تم حفظ بيانات الموقع. اضغط «نشر التغييرات» لتطبيقها على الصفحات."],
  password: ["ok", "تم تغيير كلمة المرور بنجاح."],
  reset: ["ok", "تمت إعادة البيانات من ملفات الموقع الحالية."],
  login: ["error", "بيانات الدخول غير صحيحة."]
};

export function messageFromQuery(query) {
  const key = query.get("msg");
  if (!key || !MESSAGES[key]) return null;
  return { type: MESSAGES[key][0], text: MESSAGES[key][1] };
}

export function formatPrice(price, currency) {
  if (price === null || price === undefined || price === "") return null;
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) return null;
  const formatted = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(numeric);
  return `${formatted} ${currency || "EGP"}`;
}

function csrfField(csrf) {
  return `<input type="hidden" name="_csrf" value="${attr(csrf)}">`;
}

function flashBlock(flash) {
  if (!flash) return "";
  return `<div class="flash flash-${flash.type === "error" ? "error" : "ok"}">${escapeHtml(
    flash.text
  )}</div>`;
}

function authLayout({ title, body }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)} — Watch Point</title>
  <link rel="stylesheet" href="/admin/admin.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/brand-mark-64.png">
</head>
<body class="auth-body">
  <main class="auth-card">
    <div class="auth-brand">
      <img src="/assets/images/brand-mark.webp" alt="Watch Point" width="46" height="46" style="border-radius: 10px;">
      <div>
        <strong>Watch Point</strong>
        <span>لوحة التحكم</span>
      </div>
    </div>
    ${body}
  </main>
</body>
</html>`;
}

export function setupPage({ error }) {
  return authLayout({
    title: "إنشاء كلمة مرور",
    body: `
      <h1>مرحبًا بك 👋</h1>
      <p class="muted">هذه أول مرة تفتح فيها لوحة التحكم. أنشئ كلمة مرور قوية لحماية إدارة الموقع.</p>
      ${error ? `<div class="flash flash-error">${escapeHtml(error)}</div>` : ""}
      <form method="post" action="/admin/setup" class="stack">
        <label class="field">
          <span>كلمة المرور</span>
          <input type="password" name="password" minlength="8" required autofocus autocomplete="new-password" placeholder="8 أحرف على الأقل">
        </label>
        <label class="field">
          <span>تأكيد كلمة المرور</span>
          <input type="password" name="confirm" minlength="8" required autocomplete="new-password">
        </label>
        <button class="btn btn-primary btn-block" type="submit">إنشاء وحفظ</button>
      </form>
      <p class="hint">تُحفظ كلمة المرور مشفّرة داخل <code>admin/data/auth.json</code>. احتفظ بها في مكان آمن.</p>
    `
  });
}

export function loginPage({ error }) {
  return authLayout({
    title: "تسجيل الدخول",
    body: `
      <h1>تسجيل الدخول</h1>
      <p class="muted">أدخل كلمة المرور لإدارة المنتجات والأسعار ومحتوى الموقع.</p>
      ${error ? `<div class="flash flash-error">${escapeHtml(error)}</div>` : ""}
      <form method="post" action="/admin/login" class="stack">
        <label class="field">
          <span>كلمة المرور</span>
          <input type="password" name="password" required autofocus autocomplete="current-password">
        </label>
        <button class="btn btn-primary btn-block" type="submit">دخول</button>
      </form>
      <p class="hint">نسيت كلمة المرور؟ احذف الملف <code>admin/data/auth.json</code> وأعد تشغيل السيرفر لإنشاء واحدة جديدة.</p>
    `
  });
}

const NAV = [
  { href: "/admin", label: "لوحة التحكم", key: "dashboard" },
  { href: "/admin/products", label: "المنتجات والأسعار", key: "products" },
  { href: "/admin/packages", label: "الباقات", key: "packages" },
  { href: "/admin/categories", label: "فئات المنتجات", key: "categories" },
  { href: "/admin/settings", label: "بيانات الموقع", key: "settings" }
];

function layout({ title, active, body, csrf, pending = false, flash = null }) {
  const nav = NAV.map(
    (item) =>
      `<a href="${item.href}" class="${item.key === active ? "active" : ""}">${escapeHtml(
        item.label
      )}</a>`
  ).join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)} — لوحة تحكم Watch Point</title>
  <link rel="stylesheet" href="/admin/admin.css">
  <link rel="icon" href="/assets/images/favicon.svg">
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <a class="brand" href="/admin">
        <img src="/assets/images/brand-mark.webp" alt="Watch Point" width="38" height="38" style="border-radius: 9px;">
        <span><strong>Watch Point</strong><small>لوحة التحكم</small></span>
      </a>
      <nav class="nav">${nav}</nav>
      <div class="sidebar-foot">
        <a class="btn btn-ghost btn-block" href="/" target="_blank" rel="noopener">عرض الموقع ↗</a>
        <form method="post" action="/admin/logout">
          ${csrfField(csrf)}
          <button class="btn btn-ghost btn-block" type="submit">تسجيل الخروج</button>
        </form>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <h1>${escapeHtml(title)}</h1>
        <div class="topbar-actions">
          ${pending ? '<span class="badge badge-warn">توجد تغييرات غير منشورة</span>' : '<span class="badge badge-ok">الموقع محدّث</span>'}
          <form method="post" action="/admin/publish" class="inline">
            ${csrfField(csrf)}
            <button class="btn btn-primary" type="submit">نشر التغييرات</button>
          </form>
        </div>
      </header>
      <div class="content">
        ${flashBlock(flash)}
        ${body}
      </div>
    </main>
  </div>
  <script>
    document.addEventListener("submit", function (event) {
      var form = event.target;
      if (form.matches("[data-confirm]")) {
        if (!window.confirm(form.getAttribute("data-confirm"))) event.preventDefault();
      }
    });
  </script>
</body>
</html>`;
}

export function dashboardPage({ store, stats, pending, csrf, flash }) {
  const body = `
    <div class="stats">
      <a class="stat" href="/admin/products"><span>المنتجات</span><strong>${stats.products}</strong></a>
      <a class="stat" href="/admin/packages"><span>الباقات</span><strong>${stats.packages}</strong></a>
      <a class="stat" href="/admin/categories"><span>الفئات</span><strong>${stats.categories}</strong></a>
      <a class="stat" href="/admin/products"><span>منتجات مميزة</span><strong>${stats.featured}</strong></a>
    </div>

    <div class="grid-2">
      <section class="card">
        <h2>نشر التغييرات</h2>
        <p class="muted">بعد إضافة أو تعديل أي منتج أو سعر، اضغط «نشر التغييرات» لتحديث ملفات الموقع وصفحات SEO.</p>
        <dl class="meta">
          <div><dt>آخر حفظ</dt><dd>${formatDate(store.updatedAt)}</dd></div>
          <div><dt>آخر نشر</dt><dd>${formatDate(store.publishedAt)}</dd></div>
          <div><dt>الحالة</dt><dd>${pending ? "توجد تغييرات غير منشورة" : "كل شيء منشور"}</dd></div>
        </dl>
        <form method="post" action="/admin/publish">
          ${csrfField(csrf)}
          <button class="btn btn-primary" type="submit">نشر الآن</button>
        </form>
      </section>

      <section class="card">
        <h2>إجراءات سريعة</h2>
        <div class="quick">
          <a class="quick-link" href="/admin/products/new">＋ إضافة منتج جديد</a>
          <a class="quick-link" href="/admin/packages/new">＋ إضافة باقة جديدة</a>
          <a class="quick-link" href="/admin/settings">تعديل رقم واتساب والبيانات</a>
          <a class="quick-link" href="/catalog/" target="_blank" rel="noopener">معاينة صفحات الفئات ↗</a>
        </div>
      </section>
    </div>

    <section class="card">
      <h2>آخر المنتجات</h2>
      ${
        store.products.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>المنتج</th><th>الفئة</th><th>السعر</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                ${store.products
                  .slice(-5)
                  .reverse()
                  .map((product) => {
                    const category = store.categories.find((item) => item.id === product.categoryId);
                    return `<tr>
                      <td>
                        <div class="product-cell">
                          <img src="${attr(imgSrc(product.image))}" alt="" loading="lazy">
                          <span>${escapeHtml(product.name)}</span>
                        </div>
                      </td>
                      <td>${escapeHtml(category?.name || "—")}</td>
                      <td>${formatPrice(product.price, product.priceCurrency) || '<span class="muted">اطلب آخر سعر</span>'}</td>
                      <td>${product.featured ? '<span class="badge badge-ok">مميز</span>' : '<span class="muted">—</span>'}</td>
                      <td><a class="btn btn-ghost btn-sm" href="/admin/products/${encodeURIComponent(product.id)}/edit">تعديل</a></td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table></div>`
          : '<p class="muted">لا توجد منتجات بعد.</p>'
      }
    </section>

    ${
      !store.settings.whatsappNumber
        ? `<div class="flash flash-warn">
            رقم واتساب غير مضبوط بعد، لذلك يظهر الموقع رسالة «لم يُضبط الرقم». أضفه من
            <a href="/admin/settings">بيانات الموقع</a>.
          </div>`
        : ""
    }
  `;

  return layout({
    title: "لوحة التحكم",
    active: "dashboard",
    body,
    csrf,
    pending,
    flash
  });
}

function layoutProducts(store, { q = "" } = {}) {
  const search = q.trim().toLowerCase();
  return store.products.filter((product) => {
    if (!search) return true;
    return [product.name, product.shortName, product.slug, product.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });
}

export function productsPage({ store, q, csrf, pending, flash }) {
  const list = layoutProducts(store, { q });
  const rows = list
    .map((product) => {
      const category = store.categories.find((item) => item.id === product.categoryId);
      const price = formatPrice(product.price, product.priceCurrency);
      return `<tr>
        <td>
          <div class="product-cell">
            <img src="${attr(imgSrc(product.image))}" alt="" loading="lazy">
            <div>
              <strong>${escapeHtml(product.name)}</strong>
              <small class="muted" dir="ltr">/${escapeHtml(product.slug || product.id)}</small>
            </div>
          </div>
        </td>
        <td>${escapeHtml(category?.name || "—")}</td>
        <td>${price ? `<span class="price">${escapeHtml(price)}</span>` : '<span class="muted">اطلب آخر سعر</span>'}</td>
        <td>
          ${product.demo ? '<span class="badge">تجريبي</span>' : '<span class="badge badge-ok">حقيقي</span>'}
          ${product.featured ? '<span class="badge badge-star">مميز</span>' : ""}
        </td>
        <td class="row-actions">
          <a class="btn btn-ghost btn-sm" href="/admin/products/${encodeURIComponent(product.id)}/edit">تعديل</a>
          <form method="post" action="/admin/products/${encodeURIComponent(product.id)}/delete" class="inline" data-confirm="هل تريد حذف «${escapeHtml(product.name)}»؟ لن يُحذف إلا بعد النشر.">
            ${csrfField(csrf)}
            <button class="btn btn-danger btn-sm" type="submit">حذف</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");

  const body = `
    <section class="card">
      <div class="toolbar">
        <form method="get" action="/admin/products" class="search">
          <input type="search" name="q" value="${attr(q)}" placeholder="ابحث بالاسم أو الرابط…">
          <button class="btn btn-ghost" type="submit">بحث</button>
        </form>
        <a class="btn btn-primary" href="/admin/products/new">＋ منتج جديد</a>
      </div>
      ${
        list.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>المنتج</th><th>الفئة</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>
            <p class="hint">${list.length} من ${store.products.length} منتج</p>`
          : `<div class="empty"><h3>لا توجد نتائج</h3><p class="muted">جرّب كلمة بحث أخرى أو أضف منتجًا جديدًا.</p></div>`
      }
    </section>
  `;

  return layout({
    title: "المنتجات والأسعار",
    active: "products",
    body,
    csrf,
    pending,
    flash
  });
}

function categoryOptions(store, currentId) {
  return store.categories
    .map(
      (category) =>
        `<option value="${attr(category.id)}" ${selected(category.id, currentId)}>${escapeHtml(
          category.name
        )}</option>`
    )
    .join("");
}

function imageField({ image, label = "صورة المنتج" }) {
  const preview = image
    ? `<img class="image-preview" src="${attr(imgSrc(image))}" alt="" id="image-preview">`
    : `<div class="image-preview" id="image-preview"></div>`;
  return `
    <div class="field image-field">
      <span>${escapeHtml(label)}</span>
      ${preview}
      <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp,image/avif">
      <input type="text" name="image" value="${attr(image || "")}" dir="ltr" placeholder="assets/images/product-example.svg أو رابط كامل">
      <small class="hint">ارفع صورة جديدة (JPG/PNG/WebP حتى 5 ميجابايت) أو اترك المسار الحالي كما هو.</small>
    </div>
  `;
}

export function productFormPage({ store, product, isNew: isNewOverride, errors = [], csrf, pending, flash }) {
  const isNew = isNewOverride === undefined ? !product : Boolean(isNewOverride);
  const item = product || {
    id: "",
    name: "",
    shortName: "",
    slug: "",
    categoryId: store.categories[0]?.id || "",
    description: "",
    specs: [],
    price: null,
    priceCurrency: "EGP",
    availability: "quote",
    featured: false,
    image: "",
    imageAlt: "",
    keywords: [],
    demo: false
  };

  const body = `
    ${errors.length ? `<div class="flash flash-error"><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>` : ""}
    <form method="post" action="/admin/products/save" enctype="multipart/form-data" class="card form-card">
      ${csrfField(csrf)}
      <input type="hidden" name="id" value="${attr(item.id || "")}">
      <h2>${isNew ? "إضافة منتج جديد" : "تعديل المنتج"}</h2>

      <div class="grid-2">
        <label class="field">
          <span>اسم المنتج *</span>
          <input type="text" name="name" value="${attr(item.name)}" required maxlength="120">
        </label>
        <label class="field">
          <span>الاسم المختصر</span>
          <input type="text" name="shortName" value="${attr(item.shortName || "")}" maxlength="80">
        </label>
      </div>

      <div class="grid-2">
        <label class="field">
          <span>الرابط (slug) *</span>
          <input type="text" name="slug" value="${attr(item.slug || "")}" dir="ltr" required pattern="[a-z0-9-]+" placeholder="indoor-camera-x">
          <small class="hint">حروف إنجليزية صغيرة وأرقام وشرطات فقط.</small>
        </label>
        <label class="field">
          <span>الفئة *</span>
          <select name="categoryId" required>${categoryOptions(store, item.categoryId)}</select>
        </label>
      </div>

      <label class="field">
        <span>الوصف</span>
        <textarea name="description" rows="3" maxlength="500">${escapeHtml(item.description)}</textarea>
      </label>

      <label class="field">
        <span>المواصفات (كل مواصفة في سطر)</span>
        <textarea name="specs" rows="4" placeholder="اتصال شبكي&#10;رؤية ليلية&#10;دقة 2 ميجابكسل">${escapeHtml(
          (item.specs || []).join("\n")
        )}</textarea>
      </label>

      <div class="grid-3">
        <label class="field">
          <span>السعر</span>
          <input type="number" name="price" value="${item.price === null || item.price === undefined ? "" : attr(item.price)}" min="0" step="any" placeholder="اتركه فارغًا = اطلب آخر سعر">
        </label>
        <label class="field">
          <span>العملة</span>
          <input type="text" name="priceCurrency" value="${attr(item.priceCurrency || "EGP")}" maxlength="8" dir="ltr">
        </label>
        <label class="field">
          <span>حالة التوفر</span>
          <select name="availability">
            <option value="quote" ${selected(item.availability, "quote")}>عرض سعر</option>
            <option value="in_stock" ${selected(item.availability, "in_stock")}>متوفر</option>
            <option value="out_of_stock" ${selected(item.availability, "out_of_stock")}>غير متوفر</option>
          </select>
        </label>
      </div>

      ${imageField({ image: item.image })}

      <div class="grid-2">
        <label class="field">
          <span>نص بديل للصورة (alt)</span>
          <input type="text" name="imageAlt" value="${attr(item.imageAlt || "")}" maxlength="160">
        </label>
        <label class="field">
          <span>كلمات مفتاحية (مفصولة بفاصلة)</span>
          <input type="text" name="keywords" value="${attr((item.keywords || []).join(", "))}" placeholder="كاميرا داخلية, مراقبة">
        </label>
      </div>

      <label class="check">
        <input type="checkbox" name="featured" value="1" ${checked(item.featured)}>
        <span>منتج مميز (يظهر أولًا في قسم المنتجات)</span>
      </label>

      <div class="form-actions">
        <button class="btn btn-primary" type="submit">حفظ المنتج</button>
        <a class="btn btn-ghost" href="/admin/products">إلغاء</a>
      </div>
    </form>

    ${
      !isNew
        ? `<form method="post" action="/admin/products/${encodeURIComponent(item.id)}/delete" class="danger-zone" data-confirm="تأكيد حذف المنتج؟">
            ${csrfField(csrf)}
            <div><strong>حذف المنتج</strong><p class="muted">سيُحذف نهائيًا من لوحة التحكم بعد النشر.</p></div>
            <button class="btn btn-danger" type="submit">حذف</button>
          </form>`
        : ""
    }
  `;

  return layout({
    title: isNew ? "منتج جديد" : `تعديل: ${item.name}`,
    active: "products",
    body,
    csrf,
    pending,
    flash
  });
}

export function packagesPage({ store, csrf, pending, flash }) {
  const rows = store.packages
    .map((pack) => {
      const price = formatPrice(pack.price, pack.priceCurrency);
      return `<tr>
        <td>
          <div class="product-cell">
            <img src="${attr(imgSrc(pack.image))}" alt="" loading="lazy">
            <div>
              <strong>${escapeHtml(pack.name)}</strong>
              <small class="muted">${escapeHtml(pack.audience || "")}</small>
            </div>
          </div>
        </td>
        <td>${escapeHtml(String((pack.includes || []).length))} مكوّن</td>
        <td>${price ? `<span class="price">${escapeHtml(price)}</span>` : '<span class="muted">اطلب آخر سعر</span>'}</td>
        <td>${pack.featured ? '<span class="badge badge-star">مميزة</span>' : '<span class="muted">—</span>'}</td>
        <td class="row-actions">
          <a class="btn btn-ghost btn-sm" href="/admin/packages/${encodeURIComponent(pack.id)}/edit">تعديل</a>
          <form method="post" action="/admin/packages/${encodeURIComponent(pack.id)}/delete" class="inline" data-confirm="حذف الباقة «${escapeHtml(pack.name)}»؟">
            ${csrfField(csrf)}
            <button class="btn btn-danger btn-sm" type="submit">حذف</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");

  const body = `
    <section class="card">
      <div class="toolbar">
        <p class="muted">الباقات الثلاث تظهر في قسم «الباقات» على الصفحة الرئيسية.</p>
        <a class="btn btn-primary" href="/admin/packages/new">＋ باقة جديدة</a>
      </div>
      ${
        store.packages.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>الباقة</th><th>المكونات</th><th>السعر</th><th>مميزة</th><th>إجراءات</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>`
          : '<div class="empty"><h3>لا توجد باقات</h3><p class="muted">أضف باقة جديدة لتظهر في الموقع.</p></div>'
      }
    </section>
  `;

  return layout({ title: "الباقات", active: "packages", body, csrf, pending, flash });
}

export function packageFormPage({ store, pack, isNew: isNewOverride, errors = [], csrf, pending, flash }) {
  const isNew = isNewOverride === undefined ? !pack : Boolean(isNewOverride);
  const item = pack || {
    id: "",
    slug: "",
    name: "",
    audience: "",
    description: "",
    includes: [],
    note: "",
    price: null,
    priceCurrency: "EGP",
    availability: "quote",
    featured: false,
    image: "",
    imageAlt: ""
  };

  const body = `
    ${errors.length ? `<div class="flash flash-error"><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>` : ""}
    <form method="post" action="/admin/packages/save" enctype="multipart/form-data" class="card form-card">
      ${csrfField(csrf)}
      <input type="hidden" name="id" value="${attr(item.id || "")}">
      <h2>${isNew ? "إضافة باقة" : "تعديل الباقة"}</h2>

      <div class="grid-2">
        <label class="field">
          <span>اسم الباقة *</span>
          <input type="text" name="name" value="${attr(item.name)}" required maxlength="120">
        </label>
        <label class="field">
          <span>الرابط (slug) *</span>
          <input type="text" name="slug" value="${attr(item.slug || "")}" dir="ltr" required pattern="[a-z0-9-]+">
        </label>
      </div>

      <div class="grid-2">
        <label class="field">
          <span>الجمهور المستهدف</span>
          <input type="text" name="audience" value="${attr(item.audience || "")}" maxlength="120" placeholder="للمنازل والشقق">
        </label>
        <label class="field">
          <span>ملاحظة تظهر أسفل المكونات</span>
          <input type="text" name="note" value="${attr(item.note || "")}" maxlength="240">
        </label>
      </div>

      <label class="field">
        <span>الوصف</span>
        <textarea name="description" rows="3" maxlength="500">${escapeHtml(item.description)}</textarea>
      </label>

      <label class="field">
        <span>مكونات الباقة (كل مكوّن في سطر)</span>
        <textarea name="includes" rows="5">${escapeHtml((item.includes || []).join("\n"))}</textarea>
      </label>

      <div class="grid-3">
        <label class="field">
          <span>السعر</span>
          <input type="number" name="price" value="${item.price === null || item.price === undefined ? "" : attr(item.price)}" min="0" step="any" placeholder="فارغ = اطلب آخر سعر">
        </label>
        <label class="field">
          <span>العملة</span>
          <input type="text" name="priceCurrency" value="${attr(item.priceCurrency || "EGP")}" maxlength="8" dir="ltr">
        </label>
        <label class="field">
          <span>حالة التوفر</span>
          <select name="availability">
            <option value="quote" ${selected(item.availability, "quote")}>عرض سعر</option>
            <option value="in_stock" ${selected(item.availability, "in_stock")}>متوفر</option>
            <option value="out_of_stock" ${selected(item.availability, "out_of_stock")}>غير متوفر</option>
          </select>
        </label>
      </div>

      ${imageField({ image: item.image, label: "صورة الباقة" })}

      <label class="field">
        <span>نص بديل للصورة (alt)</span>
        <input type="text" name="imageAlt" value="${attr(item.imageAlt || "")}" maxlength="160">
      </label>

      <label class="check">
        <input type="checkbox" name="featured" value="1" ${checked(item.featured)}>
        <span>باقة مميزة</span>
      </label>

      <div class="form-actions">
        <button class="btn btn-primary" type="submit">حفظ الباقة</button>
        <a class="btn btn-ghost" href="/admin/packages">إلغاء</a>
      </div>
    </form>

    ${
      !isNew
        ? `<form method="post" action="/admin/packages/${encodeURIComponent(item.id)}/delete" class="danger-zone" data-confirm="تأكيد حذف الباقة؟">
            ${csrfField(csrf)}
            <div><strong>حذف الباقة</strong><p class="muted">سيُحذف نهائيًا من لوحة التحكم بعد النشر.</p></div>
            <button class="btn btn-danger" type="submit">حذف</button>
          </form>`
        : ""
    }
  `;

  return layout({
    title: isNew ? "باقة جديدة" : `تعديل: ${item.name}`,
    active: "packages",
    body,
    csrf,
    pending,
    flash
  });
}

export function categoriesPage({ store, csrf, pending, flash }) {
  const rows = store.categories
    .map((category) => {
      const count = store.products.filter((product) => product.categoryId === category.id).length;
      return `<tr>
        <td>
          <div class="product-cell">
            <img src="${attr(imgSrc(category.image))}" alt="" loading="lazy">
            <div>
              <strong>${escapeHtml(category.name)}</strong>
              <small class="muted" dir="ltr">/${escapeHtml(category.slug)}</small>
            </div>
          </div>
        </td>
        <td>${count}</td>
        <td><a class="btn btn-ghost btn-sm" href="/catalog/${encodeURIComponent(category.slug)}.html" target="_blank" rel="noopener">معاينة ↗</a></td>
        <td class="row-actions">
          <a class="btn btn-ghost btn-sm" href="/admin/categories/${encodeURIComponent(category.id)}/edit">تعديل</a>
        </td>
      </tr>`;
    })
    .join("");

  const body = `
    <section class="card">
      <p class="muted">يمكنك تعديل اسم الفئة ووصفها وبيانات SEO الأساسية. الأدلة والأسئلة التفصيلية تُحفظ كما هي.</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>الفئة</th><th>عدد المنتجات</th><th>الصفحة</th><th>إجراءات</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="hint">لإضافة فئة جديدة أو تعديل الأدلة والأسئلة، استخدم ملف <code>js/data.js</code> أو اطلب من المطور.</p>
    </section>
  `;

  return layout({ title: "فئات المنتجات", active: "categories", body, csrf, pending, flash });
}

export function categoryFormPage({ store, category, errors = [], csrf, pending, flash }) {
  const seo = category.seo || {};
  const body = `
    ${errors.length ? `<div class="flash flash-error"><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>` : ""}
    <form method="post" action="/admin/categories/save" enctype="multipart/form-data" class="card form-card">
      ${csrfField(csrf)}
      <input type="hidden" name="id" value="${attr(category.id)}">
      <h2>تعديل الفئة: ${escapeHtml(category.name)}</h2>

      <div class="grid-2">
        <label class="field">
          <span>اسم الفئة *</span>
          <input type="text" name="name" value="${attr(category.name)}" required maxlength="120">
        </label>
        <label class="field">
          <span>الاسم الكامل (للـ SEO)</span>
          <input type="text" name="plural" value="${attr(category.plural || "")}" maxlength="160">
        </label>
      </div>

      <div class="grid-2">
        <label class="field">
          <span>الرابط (slug) *</span>
          <input type="text" name="slug" value="${attr(category.slug)}" dir="ltr" required pattern="[a-z0-9-]+">
          <small class="hint">تغيير الرابط يغيّر عنوان صفحة الفئة بعد النشر.</small>
        </label>
        <label class="field">
          <span>كلمات مفتاحية (مفصولة بفاصلة)</span>
          <input type="text" name="keywords" value="${attr((category.keywords || []).join(", "))}">
        </label>
      </div>

      <label class="field">
        <span>وصف قصير</span>
        <textarea name="description" rows="2" maxlength="300">${escapeHtml(category.description || "")}</textarea>
      </label>

      ${imageField({ image: category.image, label: "صورة الفئة" })}

      <h3 class="section-title">بيانات SEO</h3>

      <label class="field">
        <span>عنوان الصفحة (title)</span>
        <input type="text" name="seoTitle" value="${attr(seo.title || "")}" maxlength="160">
      </label>
      <label class="field">
        <span>وصف الميتا (meta description)</span>
        <textarea name="seoDescription" rows="2" maxlength="320">${escapeHtml(seo.metaDescription || "")}</textarea>
      </label>
      <label class="field">
        <span>العنوان الرئيسي (H1)</span>
        <input type="text" name="seoH1" value="${attr(seo.h1 || "")}" maxlength="160">
      </label>
      <label class="field">
        <span>مقدمة الصفحة</span>
        <textarea name="seoIntro" rows="3" maxlength="800">${escapeHtml(seo.intro || "")}</textarea>
      </label>

      <div class="form-actions">
        <button class="btn btn-primary" type="submit">حفظ الفئة</button>
        <a class="btn btn-ghost" href="/admin/categories">إلغاء</a>
      </div>
    </form>
  `;

  return layout({
    title: `تعديل: ${category.name}`,
    active: "categories",
    body,
    csrf,
    pending,
    flash
  });
}

export function settingsPage({ store, csrf, pending, flash }) {
  const settings = store.settings;
  const body = `
    <form method="post" action="/admin/settings" enctype="multipart/form-data" class="card form-card">
      ${csrfField(csrf)}
      <h2>بيانات التواصل والموقع</h2>
      <p class="muted">هذه البيانات تظهر في الهيدر والتذييل ونموذج طلب العرض ورسائل واتساب.</p>

      <div class="grid-2">
        <label class="field">
          <span>رابط الموقع بعد النشر</span>
          <input type="url" name="siteUrl" value="${attr(settings.siteUrl || "")}" dir="ltr" placeholder="https://watchpoint.com">
          <small class="hint">اتركه فارغًا للتشغيل المحلي. عند النشر استخدم النطاق النهائي ثم اضغط نشر.</small>
        </label>
        <label class="field">
          <span>رقم واتساب (دولي بدون +)</span>
          <input type="text" name="whatsappNumber" value="${attr(settings.whatsappNumber || "")}" dir="ltr" placeholder="201012345678">
        </label>
      </div>

      <div class="grid-2">
        <label class="field">
          <span>رقم الهاتف (للرابط)</span>
          <input type="text" name="phone" value="${attr(settings.phone || "")}" dir="ltr" placeholder="+201012345678">
        </label>
        <label class="field">
          <span>النص الظاهر للهاتف</span>
          <input type="text" name="phoneDisplay" value="${attr(settings.phoneDisplay || "")}" dir="ltr" placeholder="0101 234 5678">
        </label>
      </div>

      <div class="grid-2">
        <label class="field">
          <span>البريد الإلكتروني</span>
          <input type="email" name="email" value="${attr(settings.email || "")}" dir="ltr">
        </label>
        <label class="field">
          <span>منطقة الخدمة</span>
          <input type="text" name="serviceArea" value="${attr(settings.serviceArea || "")}" placeholder="مصر">
        </label>
      </div>

      <div class="grid-2">
        <label class="field">
          <span>العنوان</span>
          <input type="text" name="address" value="${attr(settings.address || "")}">
        </label>
        <label class="field">
          <span>ساعات العمل</span>
          <input type="text" name="workingHours" value="${attr(settings.workingHours || "")}" placeholder="السبت – الخميس، 9ص – 6م">
        </label>
      </div>

      <label class="field">
        <span>معرّف Google Analytics 4 (اختياري)</span>
        <input type="text" name="measurementId" value="${attr(settings.measurementId || "")}" dir="ltr" placeholder="G-XXXXXXXXXX">
        <small class="hint">اتركه فارغًا لتعطيل التحليلات تمامًا.</small>
      </label>

      <div class="form-actions">
        <button class="btn btn-primary" type="submit">حفظ البيانات</button>
      </div>
    </form>

    <form method="post" action="/admin/password" class="card form-card">
      ${csrfField(csrf)}
      <h2>تغيير كلمة المرور</h2>
      <div class="grid-2">
        <label class="field">
          <span>كلمة المرور الحالية</span>
          <input type="password" name="current" required autocomplete="current-password">
        </label>
        <label class="field">
          <span>كلمة المرور الجديدة</span>
          <input type="password" name="next" required minlength="8" autocomplete="new-password">
        </label>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" type="submit">تغيير كلمة المرور</button>
      </div>
    </form>

    <div class="card">
      <h2>نسخ احتياطي</h2>
      <p class="muted">كل عملية نشر تُنشئ نسخة احتياطية من <code>js/data.js</code> و<code>js/config.js</code> داخل <code>admin/data/backups/</code> (آخر 10 نسخ).</p>
      <p class="muted">بياناتك كلها في <code>admin/data/store.json</code>. انسخ مجلد <code>admin/data</code> للاحتفاظ بنسخة.</p>
    </div>
  `;

  return layout({ title: "بيانات الموقع", active: "settings", body, csrf, pending, flash });
}

export function publishResultPage({ store, result, csrf }) {
  const body = `
    <section class="card">
      <h2>${result.ok ? "تم نشر التغييرات بنجاح ✅" : "تعذّر النشر ❌"}</h2>
      ${
        result.error
          ? `<div class="flash flash-error">${escapeHtml(result.error)}</div>`
          : `<p class="muted">تم تحديث <code>js/data.js</code> و<code>js/config.js</code> وإعادة توليد صفحات الفئات وsitemap.</p>`
      }
      ${
        result.log
          ? `<pre class="log" dir="ltr">${escapeHtml(result.log)}</pre>`
          : ""
      }
      <div class="form-actions">
        <a class="btn btn-primary" href="/admin">العودة للوحة التحكم</a>
        <a class="btn btn-ghost" href="/" target="_blank" rel="noopener">عرض الموقع ↗</a>
      </div>
    </section>
  `;

  return layout({
    title: "نشر التغييرات",
    active: "dashboard",
    body,
    csrf,
    pending: !result.ok,
    flash: null
  });
}

export function errorPage({ status, message, csrf }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>خطأ ${status} — Watch Point</title>
  <link rel="stylesheet" href="/admin/admin.css">
</head>
<body class="auth-body">
  <main class="auth-card">
    <h1>خطأ ${status}</h1>
    <p class="muted">${escapeHtml(message)}</p>
    <a class="btn btn-primary btn-block" href="/admin">العودة للوحة التحكم</a>
  </main>
</body>
</html>`;
}

function formatDate(value) {
  if (!value) return "لم يحدث بعد";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}
