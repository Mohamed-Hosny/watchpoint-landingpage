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
  saved: ["ok", "تم الحفظ بنجاح وتحديث الموقع."],
  deleted: ["ok", "تم الحذف بنجاح وتحديث الموقع."],
  category_saved: ["ok", "تم حفظ القسم الرئيسي بنجاح."],
  category_deleted: ["ok", "تم حذف القسم الرئيسي بنجاح."],
  subcategory_saved: ["ok", "تمت إضافة الفئة التابعة بنجاح."],
  subcategory_deleted: ["ok", "تم حذف الفئة التابعة بنجاح."],
  quick_product_saved: ["ok", "⚡ تمت إضافة المنتج سريعاً وإدراجه في مكانه المناسب بنجاح!"],
  settings: ["ok", "تم حفظ بيانات الموقع."],
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
  { href: "/admin/products/quick", label: "⚡ إضافة منتج سريع", key: "quick-product" },
  { href: "/admin/categories", label: "الأقسام الرئيسية", key: "categories" },
  { href: "/admin/products", label: "كافة المنتجات", key: "products" },
  { href: "/admin/packages", label: "الباقات", key: "packages" },
  { href: "/admin/brands", label: "العلامات التجارية", key: "brands" },
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
      <a class="stat" href="/admin/categories"><span>الأقسام الرئيسية</span><strong>${stats.categories || store.categories.length}</strong></a>
      <a class="stat" href="/admin/packages"><span>الباقات</span><strong>${stats.packages}</strong></a>
      <a class="stat" href="/admin/brands"><span>العلامات التجارية</span><strong>${stats.brands || (store.brands || []).length}</strong></a>
      <a class="stat" href="/admin/products"><span>منتجات مميزة</span><strong>${stats.featured}</strong></a>
    </div>

    <div class="grid-2">
      <section class="card">
        <h2>نشر التغييرات</h2>
        <p class="muted">بعد إضافة أو تعديل أي منتج أو قسم، يتم حفظ البيانات فوراً. اضغط «نشر الآن» لإعادة بناء صفحات الـ SEO والدليل.</p>
        <dl class="meta">
          <div><dt>آخر حفظ</dt><dd>${formatDate(store.updatedAt)}</dd></div>
          <div><dt>آخر نشر</dt><dd>${formatDate(store.publishedAt)}</dd></div>
          <div><dt>الحالة</dt><dd>${pending ? "توجد تغييرات غير منشورة في صفحات الـ SEO" : "كل شيء منشور"}</dd></div>
        </dl>
        <form method="post" action="/admin/publish">
          ${csrfField(csrf)}
          <button class="btn btn-primary" type="submit">نشر الآن</button>
        </form>
      </section>

      <section class="card">
        <h2>إجراءات سريعة</h2>
        <div class="quick">
          <a class="quick-link" href="/admin/products/quick" style="border-color:#16a34a;background:#f0fdf4;color:#15803d;font-weight:700;">⚡ إضافة منتج سريع</a>
          <a class="quick-link" href="/admin/categories">📁 الأقسام الرئيسية والفئات</a>
          <a class="quick-link" href="/admin/categories/new">＋ إضافة قسم رئيسي جديد</a>
          <a class="quick-link" href="/admin/brands">🏷️ إدارة ورفع العلامات التجارية</a>
          <a class="quick-link" href="/admin/packages/new">＋ إضافة باقة جديدة</a>
          <a class="quick-link" href="/admin/settings">⚙️ تعديل بيانات الموقع</a>
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
                    return `<tr>
                      <td>
                        <div class="product-cell">
                          <img src="${attr(imgSrc(product.image))}" alt="" loading="lazy">
                          <span>${escapeHtml(product.name)}</span>
                        </div>
                      </td>
                      <td>${escapeHtml(categoryLabel(store, product.categoryId))}</td>
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

function layoutProducts(store, { q = "", category = "" } = {}) {
  const search = q.trim().toLowerCase();
  return store.products.filter((product) => {
    if (category && category !== "all") {
      const parent = store.categories.find((item) => item.id === category);
      const matchesParent = parent && (
        product.categoryId === category ||
        product.mainCategoryId === category ||
        (parent.subcategories || []).some((subcategory) => subcategory.id === product.categoryId)
      );
      if (!matchesParent && product.categoryId !== category) return false;
    }
    if (!search) return true;
    return [product.name, product.shortName, product.slug, product.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });
}

function categoryLabel(store, categoryId) {
  for (const category of store.categories) {
    if (category.id === categoryId) return category.name;
    const subcategory = (category.subcategories || []).find((item) => item.id === categoryId);
    if (subcategory) return `${category.name} ← ${subcategory.name}`;
  }
  return "—";
}

export function productsPage({ store, q, category = "", csrf, pending, flash }) {
  const list = layoutProducts(store, { q, category });
  const selectedCat = category ? categoryLabel(store, category) : "";

  const categoryFilterOptions = [
    { id: "", name: `جميع الأقسام (${store.products.length})` },
    ...store.categories.flatMap((item) => [
      {
        id: item.id,
        name: `${item.name} (${store.products.filter((product) => {
          if (product.categoryId === item.id || product.mainCategoryId === item.id) return true;
          return (item.subcategories || []).some((subcategory) => subcategory.id === product.categoryId);
        }).length})`
      },
      ...(item.subcategories || []).map((subcategory) => ({
        id: subcategory.id,
        name: `— ${subcategory.name} (${store.products.filter((product) => product.categoryId === subcategory.id).length})`
      }))
    ])
  ];

  const rows = list
    .map((product) => {
      const catName = categoryLabel(store, product.categoryId);

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
        <td>
          <a class="badge badge-link" href="/admin/products?category=${encodeURIComponent(product.mainCategoryId || product.categoryId || "")}">
            ${escapeHtml(catName)}
          </a>
        </td>
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
      <div class="toolbar" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
        <form method="get" action="/admin/products" class="search" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;flex:1;max-width:680px;">
          <input type="search" name="q" value="${attr(q)}" placeholder="ابحث بالاسم أو الرابط…" style="flex:1;min-width:180px;">
          <select name="category" onchange="this.form.submit()" style="padding:0.45rem 0.8rem;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-size:0.86rem;">
            ${categoryFilterOptions
              .map(
                (opt) =>
                  `<option value="${attr(opt.id)}" ${opt.id === category ? "selected" : ""}>${escapeHtml(
                    opt.name
                  )}</option>`
              )
              .join("")}
          </select>
          <button class="btn btn-ghost" type="submit">بحث / تصفية</button>
          ${
            q || category
              ? `<a class="btn btn-ghost" href="/admin/products">إلغاء التصفية</a>`
              : ""
          }
        </form>
        <a class="btn btn-primary" href="/admin/products/new${
          category ? `?categoryId=${encodeURIComponent(category)}` : ""
        }">＋ منتج جديد</a>
      </div>
      ${
        selectedCat
          ? `<div style="padding:0.6rem 0.9rem;background:#f0f6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:1rem;font-size:0.86rem;display:flex;align-items:center;justify-content:space-between;">
              <span>تصفية حسب قسم: <strong>${escapeHtml(selectedCat)}</strong></span>
              <a href="/admin/products" class="muted" style="text-decoration:underline;">عرض جميع الأقسام</a>
            </div>`
          : ""
      }
      ${
        list.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>المنتج</th><th>القسم / الفئة</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>
            <p class="hint">${list.length} من ${store.products.length} منتج</p>`
          : `<div class="empty"><h3>لا توجد نتائج</h3><p class="muted">جرّب اختيار قسم آخر، أو أضف منتجًا جديدًا في هذا القسم.</p><a class="btn btn-primary" href="/admin/products/new${category ? `?categoryId=${encodeURIComponent(category)}` : ""}">＋ إضافة أول منتج هنا</a></div>`
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
    .map((category) => {
      if (!category.subcategories || !category.subcategories.length) {
        return `<option value="${attr(category.id)}" ${selected(category.id, currentId)}>${escapeHtml(category.name)} (منتجات مباشرة)</option>`;
      }
      const subs = category.subcategories
        .map(
          (sub) =>
            `<option value="${attr(sub.id)}" ${selected(sub.id, currentId)}>${escapeHtml(category.name)} ← ${escapeHtml(sub.name)}</option>`
        )
        .join("");
      return `<optgroup label="${attr(category.name)}"><option value="${attr(category.id)}" ${selected(category.id, currentId)}>${escapeHtml(category.name)} (منتجات مباشرة)</option>${subs}</optgroup>`;
    })
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
      const count = store.products.filter(
        (product) =>
          product.categoryId === category.id || product.mainCategoryId === category.id
      ).length;

      const subList = category.subcategories || [];
      const subBadges = subList.length
        ? subList
            .map((s) => `<span class="badge" style="font-size:0.75rem;margin:2px;">${escapeHtml(s.name)}</span>`)
            .join("")
        : '<span class="badge badge-ok" style="font-size:0.75rem;">إضافة منتجات مباشرة (بدون فئات فرعية)</span>';

      return `<tr>
        <td>
          <div class="product-cell">
            <span style="width:48px;height:48px;border-radius:50%;background:#fff4ea;border:1.5px solid #ffe3cb;display:grid;place-items:center;overflow:hidden;flex-shrink:0;">
              <img src="${attr(imgSrc(category.image))}" alt="" style="width:28px;height:28px;object-fit:contain;" loading="lazy">
            </span>
            <div>
              <strong>${escapeHtml(category.name)}</strong>
              <small class="muted" dir="ltr">/${escapeHtml(category.slug)}</small>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex;flex-wrap:wrap;max-width:320px;gap:3px;align-items:center;">
            ${subBadges}
          </div>
          <div style="margin-top:0.35rem;">
            <a class="btn btn-ghost btn-sm" href="/admin/categories/${encodeURIComponent(category.id)}/subcategories" style="font-size:0.8rem;padding:0.2rem 0.6rem;color:#0284c7;background:#f0f9ff;border:1px solid #bae6fd;">
              📁 إدارة الفئات التابعة (${subList.length})
            </a>
          </div>
        </td>
        <td>
          <a class="badge ${count > 0 ? "badge-ok" : ""}" href="/admin/products?category=${encodeURIComponent(category.id)}" title="انقر لتصفية المنتجات في هذا القسم">
            ${count} منتج
          </a>
        </td>
        <td>
          <a class="btn btn-ghost btn-sm" href="/catalog/${encodeURIComponent(category.slug)}.html" target="_blank" rel="noopener">معاينة ↗</a>
        </td>
        <td class="row-actions" style="white-space:nowrap;">
          <a class="btn btn-ghost btn-sm" href="/admin/categories/${encodeURIComponent(category.id)}/subcategories" style="font-weight:600;">📁 الفئات (${subList.length})</a>
          <a class="btn btn-ghost btn-sm" href="/admin/products/quick?mainCategoryId=${encodeURIComponent(category.id)}">⚡ إضافة منتج</a>
          <a class="btn btn-ghost btn-sm" href="/admin/categories/${encodeURIComponent(category.id)}/edit">تعديل</a>
          <form method="post" action="/admin/categories/${encodeURIComponent(category.id)}/delete" data-confirm="هل تريد بالتأكيد حذف القسم الرئيسي «${escapeHtml(category.name)}»؟ سيتم حذف ارتباطات هذا القسم." style="display:inline;">
            ${csrfField(csrf)}
            <button class="btn btn-danger btn-sm" type="submit">حذف</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");

  const body = `
    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem;">
        <div>
          <h2 style="margin:0 0 0.25rem;">الأقسام الرئيسية للمتجر (${store.categories.length})</h2>
          <p class="muted" style="margin:0;">تحتوي الأقسام الرئيسية على الفئات الفرعية التابعة لها. يمكنك إضافة وحذف الأقسام، أو الدخول لأي قسم لإدارة فئاته ومنتجاته.</p>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <a class="btn btn-primary" href="/admin/categories/new">＋ إضافة قسم رئيسي جديد</a>
          <a class="btn btn-outline" href="/admin/products/quick">⚡ إضافة منتج سريع</a>
        </div>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>القسم الرئيسي</th><th>الفئات التابعة</th><th>المنتجات المسجلة</th><th>صفحة الدليل</th><th>إجراءات القسم</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="hint">ملاحظة: قسم «اليكترونيات عامة» لا يتطلب فئات فرعية وتُضاف إليه قطع المنتجات مباشرةً، مع إمكانية إضافة فئات فرعية لأي قسم متى شئت.</p>
    </section>
  `;

  return layout({ title: "الأقسام الرئيسية", active: "categories", body, csrf, pending, flash });
}

export function categoryFormPage({ store, category = {}, isNew = false, errors = [], csrf, pending, flash }) {
  const seo = category.seo || {};
  const isEditing = !isNew && category && category.id;
  const pageTitle = isEditing ? `تعديل القسم الرئيسي: ${category.name}` : "إضافة قسم رئيسي جديد";

  const body = `
    ${errors.length ? `<div class="flash flash-error"><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>` : ""}
    <form method="post" action="/admin/categories/save" enctype="multipart/form-data" class="card form-card">
      ${csrfField(csrf)}
      <input type="hidden" name="id" value="${attr(category.id || "")}">
      <h2>${escapeHtml(pageTitle)}</h2>

      <div class="grid-2">
        <label class="field">
          <span>اسم القسم الرئيسي *</span>
          <input type="text" name="name" value="${attr(category.name || "")}" required maxlength="120" placeholder="مثال: أنظمة الإنذار المبكر">
        </label>
        <label class="field">
          <span>الاسم الكامل (للـ SEO)</span>
          <input type="text" name="plural" value="${attr(category.plural || "")}" maxlength="160" placeholder="مثال: توريد وتركيب أجهزة الإنذار">
        </label>
      </div>

      <div class="grid-2">
        <label class="field">
          <span>الرابط (slug) *</span>
          <input type="text" name="slug" value="${attr(category.slug || "")}" dir="ltr" required pattern="[a-z0-9-]+" placeholder="alarm-systems">
          <small class="hint">حروف إنجليزية صغيرة وأرقام وشرطات فقط.</small>
        </label>
        <label class="field">
          <span>كلمات مفتاحية (مفصولة بفاصلة)</span>
          <input type="text" name="keywords" value="${attr((category.keywords || []).join(", "))}" placeholder="إنذار, حماية, سرقة">
        </label>
      </div>

      <label class="field">
        <span>وصف القسم الرئيسي</span>
        <textarea name="description" rows="2" maxlength="300" placeholder="وصف موجز يظهر في دليل الأقسام والصفحة الرئيسية...">${escapeHtml(category.description || "")}</textarea>
      </label>

      ${imageField({ image: category.image, label: "أيقونة / صورة القسم" })}
      <p class="hint">تظهر صورة القسم في كروت الأقسام في الصفحة الرئيسية ودليل المتجر.</p>

      <h3 class="section-title">بيانات محركات البحث (SEO)</h3>

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
        <button class="btn btn-primary" type="submit">${isEditing ? "حفظ التعديلات" : "إضافة القسم الرئيسي"}</button>
        <a class="btn btn-ghost" href="/admin/categories">إلغاء</a>
      </div>
    </form>
  `;

  return layout({
    title: pageTitle,
    active: "categories",
    body,
    csrf,
    pending,
    flash
  });
}

export function categorySubcategoriesPage({ store, category, csrf, pending, flash }) {
  const subcategories = category.subcategories || [];
  const allCategoryProducts = store.products.filter(
    (p) => p.categoryId === category.id || p.mainCategoryId === category.id
  );

  let subcategoriesHtml = "";

  if (subcategories.length > 0) {
    subcategoriesHtml = subcategories
      .map((sub) => {
        const productsInSub = store.products.filter(
          (p) => p.categoryId === sub.id || (p.mainCategoryId === category.id && p.categoryId === sub.id)
        );

        const productRows = productsInSub
          .map((prod) => {
            const formattedPrice = formatPrice(prod.price, prod.priceCurrency);
            return `<tr>
              <td style="width:50px;">
                <img src="${attr(imgSrc(prod.image))}" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff;" loading="lazy">
              </td>
              <td>
                <strong style="font-size:0.92rem;color:#0f172a;">${escapeHtml(prod.name)}</strong>
                ${prod.shortName ? `<small class="muted" style="display:block;font-size:0.75rem;">${escapeHtml(prod.shortName)}</small>` : ""}
              </td>
              <td style="white-space:nowrap;">
                <span style="font-weight:700;color:#0284c7;">${escapeHtml(formattedPrice || "—")}</span>
              </td>
              <td class="row-actions" style="white-space:nowrap;text-align:left;">
                <a class="btn btn-ghost btn-sm" href="/admin/products/${encodeURIComponent(prod.id)}/edit">تعديل</a>
                <form method="post" action="/admin/products/${encodeURIComponent(prod.id)}/delete" data-confirm="هل تريد حذف المنتج «${escapeHtml(prod.name)}» من هذه الفئة؟" style="display:inline;">
                  <input type="hidden" name="returnTo" value="/admin/categories/${encodeURIComponent(category.id)}/subcategories">
                  ${csrfField(csrf)}
                  <button class="btn btn-danger btn-sm" type="submit">حذف</button>
                </form>
              </td>
            </tr>`;
          })
          .join("");

        return `
          <div class="card" style="margin-bottom:1.25rem;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:0.75rem 1.25rem;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;gap:0.75rem;">
              <div style="display:flex;align-items:center;gap:0.6rem;">
                <span style="font-size:1.2rem;">📁</span>
                <div>
                  <h3 style="margin:0;font-size:1.05rem;color:#0f172a;">${escapeHtml(sub.name)}</h3>
                  <small class="muted" dir="ltr">slug: ${escapeHtml(sub.slug || sub.id)}</small>
                </div>
                <span class="badge ${productsInSub.length > 0 ? "badge-ok" : ""}" style="margin-right:0.5rem;">${productsInSub.length} منتجات</span>
              </div>
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <a class="btn btn-primary btn-sm" href="/admin/products/quick?mainCategoryId=${encodeURIComponent(category.id)}&categoryId=${encodeURIComponent(sub.id)}">
                  ＋ إضافة منتج في هذه الفئة
                </a>
                <form method="post" action="/admin/categories/${encodeURIComponent(category.id)}/subcategories/${encodeURIComponent(sub.id)}/delete" data-confirm="هل تريد بالتأكيد حذف فئة «${escapeHtml(sub.name)}»؟ سيتم فك ارتباط منتجاتها." style="display:inline;">
                  ${csrfField(csrf)}
                  <button class="btn btn-danger btn-sm" type="submit">حذف الفئة</button>
                </form>
              </div>
            </div>
            <div style="padding:0.5rem 1rem;">
              ${
                productsInSub.length > 0
                  ? `<div class="table-wrap"><table class="table" style="margin:0;">
                      <thead><tr><th>الصورة</th><th>اسم المنتج</th><th>السعر</th><th style="text-align:left;">إجراءات</th></tr></thead>
                      <tbody>${productRows}</tbody>
                    </table></div>`
                  : `<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.9rem;">
                      لا توجد منتجات مسجلة في هذه الفئة حتى الآن.
                      <div style="margin-top:0.5rem;">
                        <a class="btn btn-outline btn-sm" href="/admin/products/quick?mainCategoryId=${encodeURIComponent(category.id)}&categoryId=${encodeURIComponent(sub.id)}">
                          ⚡ أضف منتجك الأول هنا سريعاً
                        </a>
                      </div>
                    </div>`
              }
            </div>
          </div>
        `;
      })
      .join("");
  } else {
    // For direct categories like general-electronics
    const directProducts = allCategoryProducts;
    const directRows = directProducts
      .map((prod) => {
        const formattedPrice = formatPrice(prod.price, prod.priceCurrency);
        return `<tr>
          <td style="width:50px;">
            <img src="${attr(imgSrc(prod.image))}" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff;" loading="lazy">
          </td>
          <td>
            <strong style="font-size:0.92rem;color:#0f172a;">${escapeHtml(prod.name)}</strong>
            ${prod.shortName ? `<small class="muted" style="display:block;font-size:0.75rem;">${escapeHtml(prod.shortName)}</small>` : ""}
          </td>
          <td style="white-space:nowrap;">
            <span style="font-weight:700;color:#0284c7;">${escapeHtml(formattedPrice || "—")}</span>
          </td>
          <td class="row-actions" style="white-space:nowrap;text-align:left;">
            <a class="btn btn-ghost btn-sm" href="/admin/products/${encodeURIComponent(prod.id)}/edit">تعديل</a>
            <form method="post" action="/admin/products/${encodeURIComponent(prod.id)}/delete" data-confirm="هل تريد حذف المنتج «${escapeHtml(prod.name)}»؟" style="display:inline;">
              <input type="hidden" name="returnTo" value="/admin/categories/${encodeURIComponent(category.id)}/subcategories">
              ${csrfField(csrf)}
              <button class="btn btn-danger btn-sm" type="submit">حذف</button>
            </form>
          </td>
        </tr>`;
      })
      .join("");

    subcategoriesHtml = `
      <div class="card" style="margin-bottom:1.5rem;border:1.5px dashed #cbd5e1;padding:1.5rem;text-align:center;border-radius:12px;">
        <span style="font-size:2rem;display:block;margin-bottom:0.5rem;">📦</span>
        <h3 style="margin:0 0 0.5rem;">قسم المنتجات المباشرة</h3>
        <p class="muted" style="max-width:550px;margin:0 auto 1.25rem;">
          هذا القسم لا يحتوي على فئات فرعية؛ حيث يتم إدراج قطع ومنتجات «${escapeHtml(category.name)}» فيه مباشرة. يمكنك إضافة قطع منتجات أو إضافة فئات فرعية له بالأسفل.
        </p>
        <a class="btn btn-primary" href="/admin/products/quick?mainCategoryId=${encodeURIComponent(category.id)}">
          ⚡ إضافة منتج سريع في قسم ${escapeHtml(category.name)}
        </a>
      </div>
      ${
        directProducts.length > 0
          ? `<div class="card" style="margin-bottom:1.5rem;">
              <h3 style="margin:0 0 1rem;">المنتجات المسجلة في هذا القسم (${directProducts.length})</h3>
              <div class="table-wrap"><table class="table">
                <thead><tr><th>الصورة</th><th>اسم المنتج</th><th>السعر</th><th style="text-align:left;">إجراءات</th></tr></thead>
                <tbody>${directRows}</tbody>
              </table></div>
            </div>`
          : ""
      }
    `;
  }

  const body = `
    <div style="margin-bottom:1.25rem;">
      <a href="/admin/categories" class="muted" style="font-size:0.9rem;text-decoration:none;">
        ‹ العودة إلى الأقسام الرئيسية
      </a>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;flex-wrap:wrap;gap:0.75rem;">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <span style="width:48px;height:48px;border-radius:50%;background:#fff4ea;border:1.5px solid #ffe3cb;display:grid;place-items:center;overflow:hidden;flex-shrink:0;">
            <img src="${attr(imgSrc(category.image))}" alt="" style="width:28px;height:28px;object-fit:contain;" loading="lazy">
          </span>
          <div>
            <h2 style="margin:0;font-size:1.35rem;">فئات قسم: ${escapeHtml(category.name)}</h2>
            <p class="muted" style="margin:0.15rem 0 0;font-size:0.85rem;">
              الرابط: /${escapeHtml(category.slug)} | عدد الفئات التابعة: ${subcategories.length} | إجمالي المنتجات: ${allCategoryProducts.length}
            </p>
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <a class="btn btn-primary" href="/admin/products/quick?mainCategoryId=${encodeURIComponent(category.id)}">
            ⚡ إضافة منتج سريع
          </a>
          <a class="btn btn-outline" href="#add-subcat-form">＋ إضافة فئة فرعية جديدة</a>
          <a class="btn btn-ghost" href="/admin/categories/${encodeURIComponent(category.id)}/edit">تعديل بيانات القسم</a>
        </div>
      </div>
    </div>

    <!-- Subcategories & Products List -->
    <section>
      ${subcategoriesHtml}
    </section>

    <!-- Add Subcategory Form -->
    <section class="card form-card" id="add-subcat-form" style="margin-top:2rem;">
      <h3 style="margin:0 0 0.5rem;">＋ إضافة فئة فرعية جديدة لقسم «${escapeHtml(category.name)}»</h3>
      <p class="muted" style="margin:0 0 1.25rem;">ستظهر هذه الفئة التابعة فوراً تحت قسم «${escapeHtml(category.name)}» في المتجر لتمكين العميل من تصفية المنتجات.</p>
      
      <form method="post" action="/admin/categories/${encodeURIComponent(category.id)}/subcategories/save" class="stack" style="max-width:680px;">
        ${csrfField(csrf)}
        
        <div class="grid-2">
          <label class="field">
            <span>اسم الفئة الفرعية *</span>
            <input type="text" name="name" required placeholder="مثال: كاميرات حرارية أو أجهزة UPS" maxlength="100">
          </label>
          <label class="field">
            <span>المعرّف الإنجليزي (slug)</span>
            <input type="text" name="slug" dir="ltr" placeholder="thermal-cameras (اختياري)">
            <small class="hint">يتم إنشاؤه تلقائياً إذا تُرك فارغاً.</small>
          </label>
        </div>

        <label class="field">
          <span>أيقونة الفئة (اسم أو رمز اختياري)</span>
          <input type="text" name="icon" dir="ltr" placeholder="camera / wifi / server / shield">
        </label>

        <div class="form-actions" style="margin-top:1rem;">
          <button class="btn btn-primary" type="submit">حفظ وإضافة الفئة الفرعية</button>
          <a class="btn btn-ghost" href="/admin/categories">إلغاء</a>
        </div>
      </form>
    </section>
  `;

  return layout({
    title: `فئات: ${category.name}`,
    active: "categories",
    body,
    csrf,
    pending,
    flash
  });
}

export function quickProductPage({ store, initialMainId = "", initialSubId = "", errors = [], csrf, pending, flash }) {
  const categories = store.categories || [];
  const selectedMain = initialMainId || (categories[0] ? categories[0].id : "");

  const mainOptions = categories
    .map(
      (cat) => `<option value="${attr(cat.id)}" ${selected(cat.id, selectedMain)}>${escapeHtml(cat.name)}</option>`
    )
    .join("");

  const body = `
    ${errors.length ? `<div class="flash flash-error"><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>` : ""}

    <form method="post" action="/admin/products/quick/save" enctype="multipart/form-data" class="card form-card" style="max-width:760px;margin:0 auto;">
      ${csrfField(csrf)}
      <div style="border-bottom:1px solid #e2e8f0;padding-bottom:1rem;margin-bottom:1.5rem;">
        <span style="font-size:1.8rem;display:inline-block;vertical-align:middle;margin-left:0.4rem;">⚡</span>
        <h2 style="display:inline-block;margin:0;vertical-align:middle;font-size:1.4rem;">إضافة منتج سريع</h2>
        <p class="muted" style="margin:0.4rem 0 0;">
          أدخل بيانات المنتج الأساسية واختر قسمه الرئيسي وفئته، وسيقوم النظام بإدراجه فوراً بمكانه المناسب في المتجر ولوحة التحكم.
        </p>
      </div>

      <label class="field">
        <span>اسم المنتج *</span>
        <input type="text" name="name" required placeholder="مثال: كاميرا مراقبة هيكفيجن 5 ميجا بكسل IP داخلي بدقة 4K" maxlength="180">
      </label>

      <div class="grid-2">
        <label class="field">
          <span>السعر بالجنيه (EGP) *</span>
          <input type="number" name="price" step="0.5" min="0" required placeholder="1850">
        </label>
        <label class="field">
          <span>كود الموديل / اسم مختصر</span>
          <input type="text" name="shortName" placeholder="مثال: DS-2CD2153G2-I" maxlength="120">
        </label>
      </div>

      <div class="grid-2" style="background:#f8fafc;padding:1rem;border-radius:10px;border:1px solid #e2e8f0;margin:0.5rem 0 1rem;">
        <label class="field">
          <span style="font-weight:700;color:#0f172a;">القسم الرئيسي *</span>
          <select name="mainCategoryId" id="quickMainCategory" required style="font-weight:600;color:#0284c7;">
            ${mainOptions}
          </select>
        </label>

        <label class="field">
          <span style="font-weight:700;color:#0f172a;">الفئة التابعة *</span>
          <select name="categoryId" id="quickSubCategory" required style="font-weight:600;">
            <!-- Dynamic options -->
          </select>
        </label>
      </div>

      <div class="field image-field">
        <span>صورة المنتج</span>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div>
            <label style="display:block;font-size:0.8rem;color:#64748b;margin-bottom:0.25rem;">رفع ملف من جهازك (JPG/PNG/WebP):</label>
            <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp,image/avif">
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;color:#64748b;margin-bottom:0.25rem;">أو رابط / مسار صورة جاهز:</label>
            <input type="text" name="imageUrl" dir="ltr" placeholder="assets/images/uploads/...">
          </div>
        </div>
      </div>

      <label class="field">
        <span>المواصفات والوصف المختصر</span>
        <textarea name="description" rows="3" placeholder="مواصفات سريعة (دقة، مسافة الرؤية الليلية، نوع التوصيل، مقاومة العوامل الجوية، إلخ...)"></textarea>
      </label>

      <label class="check" style="margin:0.75rem 0;">
        <input type="checkbox" name="featured" value="1">
        <span>عرض هذا المنتج كـ «منتج مميز» في الواجهة الرئيسية للمتجر</span>
      </label>

      <div class="form-actions" style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #e2e8f0;">
        <button class="btn btn-primary" type="submit" style="font-size:1.05rem;padding:0.75rem 2rem;background:#16a34a;border-color:#16a34a;">
          ⚡ حفظ وإدراج المنتج فوراً
        </button>
        <a class="btn btn-ghost" href="/admin/categories">إلغاء</a>
      </div>
    </form>

    <script>
      (function() {
        var catData = ${JSON.stringify(
          categories.map((c) => ({
            id: c.id,
            name: c.name,
            subcategories: (c.subcategories || []).map((s) => ({ id: s.id, name: s.name }))
          }))
        )};

        var mainSel = document.getElementById("quickMainCategory");
        var subSel = document.getElementById("quickSubCategory");
        var targetSub = "${escapeHtml(initialSubId)}";

        function refreshSubcategories() {
          var selectedId = mainSel.value;
          var found = catData.find(function(c) { return c.id === selectedId; });
          subSel.innerHTML = "";

          if (!found || !found.subcategories || found.subcategories.length === 0) {
            var opt = document.createElement("option");
            opt.value = selectedId;
            opt.textContent = "— إدراج مباشر في قسم " + (found ? found.name : "") + " —";
            subSel.appendChild(opt);
          } else {
            found.subcategories.forEach(function(sub) {
              var opt = document.createElement("option");
              opt.value = sub.id;
              opt.textContent = sub.name;
              if (sub.id === targetSub) opt.selected = true;
              subSel.appendChild(opt);
            });
          }
        }

        if (mainSel && subSel) {
          mainSel.addEventListener("change", function() {
            targetSub = "";
            refreshSubcategories();
          });
          refreshSubcategories();
        }
      })();
    </script>
  `;

  return layout({
    title: "⚡ إضافة منتج سريع",
    active: "quick-product",
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

export function brandsPage({ store, csrf, pending, flash }) {
  const brands = store.brands || [];

  const cards = brands
    .map((brand) => {
      const logoUrl = imgSrc(brand.logo);
      return `
        <div class="card brand-admin-card" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:0.9rem 1.1rem;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
          <div style="display:flex;align-items:center;gap:0.9rem;">
            <div style="width:110px;height:50px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;display:grid;place-items:center;padding:4px 8px;overflow:hidden;flex-shrink:0;">
              <img src="${attr(logoUrl)}" alt="${escapeHtml(brand.name || '')}" style="max-width:100%;max-height:100%;object-fit:contain;">
            </div>
            <div>
              <strong style="display:block;font-size:0.95rem;color:#0f172a;">${escapeHtml(brand.name || "علامة تجارية")}</strong>
              <small class="muted" dir="ltr" style="font-size:0.75rem;">${escapeHtml(brand.logo || "")}</small>
            </div>
          </div>
          <form method="post" action="/admin/brands/${encodeURIComponent(brand.id)}/delete" data-confirm="هل تريد بالتأكيد حذف «${escapeHtml(brand.name || 'العلامة التجارية')}» من الموقع؟">
            ${csrfField(csrf)}
            <button class="btn btn-danger btn-sm" type="submit">حذف</button>
          </form>
        </div>
      `;
    })
    .join("");

  const body = `
    <section class="card" style="margin-bottom:1.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1.2rem;">
        <div>
          <h2 style="margin:0 0 0.35rem;">العلامات التجارية والشركاء (${brands.length})</h2>
          <p class="muted" style="margin:0;">هذه هي شعارات الماركات والشركات العالمية التي تظهر للعميل في قسم «العلامات التجارية» على الصفحة الرئيسية لبناء ثقة ومصداقية الموقع.</p>
        </div>
        <a class="btn btn-primary" href="#add-brand-form">＋ إضافة علامة تجارية جديدة</a>
      </div>

      ${
        brands.length
          ? `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:0.9rem;">${cards}</div>`
          : `<div class="empty"><h3>لا توجد علامات تجارية مسجلة</h3><p class="muted">أضف شعار أول علامة تجارية من النموذج المخصص بالأسفل.</p></div>`
      }
    </section>

    <section class="card form-card" id="add-brand-form">
      <h2>إضافة علامة تجارية جديدة</h2>
      <p class="muted">يكفي رفع صورة أو شعار العلامة التجارية فقط (SVG، PNG، WebP، أو JPG) لتضاف فورًا إلى المتجر وتظهر للعملاء بعد النشر.</p>

      <form method="post" action="/admin/brands/save" enctype="multipart/form-data" class="stack" style="max-width:620px;">
        ${csrfField(csrf)}
        
        <label class="field">
          <span>شعار العلامة التجارية (صورة / لوجو) *</span>
          <input type="file" name="image" accept="image/*" required style="padding:0.75rem;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:10px;cursor:pointer;">
          <small class="hint">يُفضل استخدام لوجو بجودة عالية (PNG مفرغة أو SVG أو WebP).</small>
        </label>

        <label class="field">
          <span>اسم العلامة التجارية (اختياري)</span>
          <input type="text" name="name" placeholder="مثال: Hikvision، Dahua، EZVIZ، Western Digital..." maxlength="80">
          <small class="hint">إذا تُرك فارغًا سيُحدد الاسم تلقائيًا من اسم ملف الصورة.</small>
        </label>

        <div style="display:flex;gap:0.75rem;align-items:center;margin-top:0.6rem;">
          <button class="btn btn-primary" type="submit">＋ رفع وحفظ العلامة التجارية</button>
        </div>
      </form>
    </section>
  `;

  return layout({
    title: "العلامات التجارية والشركاء",
    active: "brands",
    body,
    csrf,
    pending,
    flash
  });
}
