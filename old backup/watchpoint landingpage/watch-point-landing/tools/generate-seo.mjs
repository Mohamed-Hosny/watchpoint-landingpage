/* ==========================================================================
   Watch Point — Programmatic SEO generator
   --------------------------------------------------------------------------
   Usage:  node tools/generate-seo.mjs
   Reads js/config.js + js/data.js, then writes:
   - catalog/index.html
   - catalog/<slug>.html  (one static page per category)
   - catalog/catalog.json (ERP / integration snapshot)
   - privacy.html
   - sitemap.xml
   - robots.txt
   - llms.txt
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TODAY = new Date().toISOString().slice(0, 10);

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function loadData() {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(read("js/config.js"), context, { filename: "js/config.js" });
  vm.runInContext(read("js/data.js"), context, { filename: "js/data.js" });

  const config = context.window.WP_CONFIG;
  const categories = context.window.WP_CATEGORIES || [];
  const products = context.window.WP_PRODUCTS || [];
  const packages = context.window.WP_PACKAGES || [];

  if (!config) throw new Error("WP_CONFIG is missing.");
  if (!categories.length) throw new Error("No categories found in js/data.js.");
  if (!products.length) throw new Error("No products found in js/data.js.");

  return { config, categories, products, packages };
}

const { config, categories, products, packages } = loadData();

const SITE = config.site || {};
const COMPANY = config.company || {};
const UI = config.ui || {};
const CONTACT = config.contact || {};

const SITE_URL = String(SITE.url || "").trim().replace(/\/$/, "");
const BASE = SITE_URL || "https://watchpoint.example.com";
const BRAND = COMPANY.name || "Watch Point";

function publicUrl(relative, fallback = relative) {
  const clean = String(relative || "").replace(/^\.?\//, "");
  return SITE_URL ? SITE_URL + "/" + clean : fallback;
}

function publicImage(prefix, relative) {
  const clean = String(relative || "").replace(/^\.?\//, "");
  return SITE_URL ? SITE_URL + "/" + clean : prefix + clean;
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

function image(value) {
  return String(value || "assets/images/brand-mark.webp")
    .replace(/^\.?\//, "")
    .replace(/^assets\//, "assets/");
}

function prefixImage(prefix, value) {
  const clean = image(value);
  if (/^(https?:)?\/\//i.test(clean) || clean.startsWith("/")) return clean;
  return prefix + clean;
}

function pageTitle(label) {
  const template = (config.seo && config.seo.titleTemplate) || "%s | Watch Point";
  return template.replace("%s", label);
}

function categoryById(id) {
  return categories.find((category) => category.id === id);
}

function productForCategory(category) {
  return products.find((product) => product.categoryId === category.id);
}

function relatedCategories(category, count = 3) {
  const explicitlyRelated = category.related || [];
  const chosen = explicitlyRelated
    .map((id) => categoryById(id))
    .filter(Boolean);

  categories.forEach((item) => {
    if (item.id !== category.id && !chosen.some((entry) => entry.id === item.id)) {
      chosen.push(item);
    }
  });

  return chosen.slice(0, count);
}

function productsInCategory(category) {
  return products.filter((product) => product.categoryId === category.id);
}

function productPageFile(product) {
  return "product-" + String(product.slug || product.id).replace(/[^a-z0-9-]/gi, "-") + ".html";
}

function productPriceLabel(product) {
  const value = product.price;
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const amount = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(numeric);
  return amount + " " + (product.priceCurrency === "USD" ? "$" : "ج.م");
}

function renderSeoPriceBox(product, isPackage = false) {
  const value = product ? product.price : null;
  if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
    const numeric = Number(value);
    const amount = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(numeric);
    const curr = product.priceCurrency === "USD" ? "$" : "ج.م";
    return `
      <div class="price-box price-box--numeric">
        <div class="price-top">
          <span class="price-label">السعر:</span>
          <span class="price-badge-stock">متاح للتوريد والتركيب</span>
        </div>
        <div class="price-main">
          <span class="price-amount">${esc(amount)}</span>
          <span class="price-unit">${esc(curr)}</span>
        </div>
        <span class="price-subtext">${isPackage ? "سعر الباقة يشمل التوريد والتركيب والبرمجة" : "شامل التوريد والضمان الفني المعتمد"}</span>
      </div>`;
  }

  return `
    <div class="price-box price-box--quote">
      <div class="price-top">
        <span class="price-label">${isPackage ? "سعر الباقة:" : "عرض السعر:"}</span>
        <span class="price-badge-quote">أفضل سعر جملة</span>
      </div>
      <div class="price-main">
        <span class="price-quote-text">اطلب آخر سعر</span>
        <svg class="icon price-quote-icon" aria-hidden="true"><use href="#icon-clipboard"/></svg>
      </div>
      <span class="price-subtext">السعر يُحدد بدقة بعد المعاينة الفنية مجانًا</span>
    </div>`;
}

/* ------------------------------- Icons ----------------------------------- */
function sprite() {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="svg-sprite" aria-hidden="true" focusable="false">
  <symbol id="icon-whatsapp" viewBox="0 0 24 24">
    <path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.8A8.5 8.5 0 1 1 20.5 11.6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M8.1 7.6c.4-.1.7 0 .9.4l.7 1.6c.1.3.1.5-.1.7l-.6.7c-.2.2-.2.4 0 .7.7 1.2 1.7 2.2 2.9 2.9.3.2.5.2.7 0l.7-.6c.2-.2.4-.2.7-.1l1.6.7c.4.2.5.5.4.9-.2 1-1 1.7-2 1.8-1.1.1-2.7-.4-4.5-2.1-1.8-1.8-2.5-3.5-2.4-4.6.1-1 .8-1.8 1.8-2Z" fill="currentColor"/>
  </symbol>
  <symbol id="icon-phone" viewBox="0 0 24 24"><path d="M6.6 3.8h2.1l1.4 3.5-1.7 1.3a13 13 0 0 0 6 6l1.3-1.7 3.5 1.4v2.1a2 2 0 0 1-2.2 2C10.7 18 6 13.3 4.6 6A2 2 0 0 1 6.6 3.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="icon-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="icon-pin" viewBox="0 0 24 24"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
  <symbol id="icon-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="icon-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8 12 2.5 2.5L16 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="icon-arrow-left" viewBox="0 0 24 24"><path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="icon-chevron-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="icon-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="icon-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="icon-shield" viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.5 12 2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="icon-send" viewBox="0 0 24 24"><path d="m3 11 18-8-8 18-2.5-7.5L3 11Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10.5 13.5 21 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="icon-chat" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4V5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
  <symbol id="icon-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
</svg>`;
}

/* --------------------------- Shared partials ----------------------------- */

function siteHeader(prefix) {
  const p = prefix;
  return `${sprite()}
<a class="skip-link" href="#main-content">تجاوز إلى المحتوى الرئيسي</a>
<header class="site-header" id="site-header">
  <div class="container header-inner">
    <a class="brand" href="${p}index.html" aria-label="${esc(BRAND)} — الصفحة الرئيسية">
      <img class="brand-mark" src="${p}assets/images/brand-mark.webp" alt="Watch Point" width="48" height="48">
      <span class="brand-copy">
        <span class="brand-name" lang="en">WATCH <span class="brand-accent">POINT</span></span>
        <span class="brand-sub">INTEGRATED SECURITY SOLUTIONS</span>
      </span>
    </a>
    <nav class="desktop-nav" aria-label="التنقل الرئيسي">
      <ul>
        <li><a href="${p}index.html#products">المنتجات</a></li>
        <li><a href="${p}index.html#packages">الباقات</a></li>
        <li><a href="${p}index.html#services">الخدمات</a></li>
        <li><a href="${p}index.html#about">من نحن</a></li>
        <li><a href="${p}index.html#steps">طريقة العمل</a></li>
        <li><a href="${p}index.html#faq">الأسئلة</a></li>
        <li><a href="${p}index.html#contact">تواصل</a></li>
      </ul>
    </nav>
    <div class="header-actions">
      <a class="btn btn--primary btn--sm header-cta" href="${p}index.html#contact">
        اطلب عرض سعر
        <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
      </a>
      <button class="menu-toggle" id="menu-toggle" type="button" aria-label="فتح قائمة التنقل" aria-controls="mobile-menu" aria-expanded="false">
        <svg class="icon menu-icon" aria-hidden="true"><use href="#icon-menu"/></svg>
        <svg class="icon close-icon" aria-hidden="true"><use href="#icon-x"/></svg>
      </button>
    </div>
  </div>
  <div class="mobile-menu" id="mobile-menu" aria-hidden="true" inert>
    <nav class="mobile-nav" aria-label="التنقل على الموبايل">
      <a href="${p}index.html#products"><span>المنتجات</span><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a>
      <a href="${p}index.html#packages"><span>الباقات</span><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a>
      <a href="${p}index.html#services"><span>الخدمات</span><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a>
      <a href="${p}index.html#about"><span>من نحن</span><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a>
      <a href="${p}index.html#steps"><span>طريقة العمل</span><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a>
      <a href="${p}index.html#faq"><span>الأسئلة الشائعة</span><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a>
      <a href="${p}index.html#contact"><span>تواصل معنا</span><svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a>
    </nav>
    <div class="mobile-menu-footer">
      <a class="btn btn--primary btn--block" href="${p}index.html#contact">اطلب عرض سعر</a>
      <a class="btn btn--whatsapp btn--block" href="${p}index.html#contact" data-wa-message="مرحبًا Watch Point، أرغب في الاستفسار عن أنظمة المراقبة.">
        <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
        تواصل عبر واتساب
      </a>
    </div>
  </div>
</header>`;
}

function siteFooter(prefix) {
  const p = prefix;
  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <a class="brand brand--footer" href="${p}index.html" aria-label="${esc(BRAND)} — الصفحة الرئيسية">
        <img class="brand-mark" src="${p}assets/images/brand-mark.webp" alt="Watch Point" width="48" height="48" loading="lazy">
        <span class="brand-copy">
          <span class="brand-name" lang="en">WATCH <span class="brand-accent">POINT</span></span>
          <span class="brand-sub">INTEGRATED SECURITY SOLUTIONS</span>
        </span>
      </a>
      <p>توريد وتركيب كاميرات المراقبة والأنظمة الأمنية للمنازل والمحلات والشركات في مصر. حماية ما يهمك أولاً.</p>
      <a class="footer-wa" href="${p}index.html#contact" data-wa-message="مرحبًا Watch Point، أرغب في الاستفسار عن أنظمة المراقبة.">
        <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
        تواصل عبر واتساب
      </a>
    </div>
    <nav class="footer-col" aria-label="روابط الموقع">
      <h4>روابط سريعة</h4>
      <ul>
        <li><a href="${p}index.html#products">المنتجات</a></li>
        <li><a href="${p}index.html#packages">الباقات</a></li>
        <li><a href="${p}index.html#services">الخدمات</a></li>
        <li><a href="${p}index.html#about">من نحن</a></li>
        <li><a href="${p}index.html#faq">الأسئلة الشائعة</a></li>
        <li><a href="${p}catalog/index.html">دليل الفئات</a></li>
      </ul>
    </nav>
    <nav class="footer-col" aria-label="الخدمات">
      <h4>الخدمات</h4>
      <ul>
        <li><a href="${p}index.html#services">معاينة الموقع</a></li>
        <li><a href="${p}index.html#services">توريد الأنظمة</a></li>
        <li><a href="${p}index.html#services">التركيب والبرمجة</a></li>
        <li><a href="${p}index.html#services">الصيانة والدعم</a></li>
      </ul>
    </nav>
    <div class="footer-col footer-contact">
      <h4>تواصل</h4>
      <ul>
        <li id="footer-phone-item" hidden><a id="footer-phone-link" href="${p}index.html#contact"><svg class="icon" aria-hidden="true"><use href="#icon-phone"/></svg><span id="footer-phone-value">—</span></a></li>
        <li id="footer-email-item" hidden><a id="footer-email-link" href="${p}index.html#contact"><svg class="icon" aria-hidden="true"><use href="#icon-mail"/></svg><span id="footer-email-value">—</span></a></li>
        <li><a href="${p}index.html#contact"><svg class="icon" aria-hidden="true"><use href="#icon-pin"/></svg><span>نطاق الخدمة: مصر</span></a></li>
        <li><a href="${p}index.html#contact" data-wa-message="مرحبًا Watch Point، أرغب في طلب عرض سعر."><svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg><span>واتساب</span></a></li>
      </ul>
      <p class="footer-note">الخدمة بالتنسيق المسبق والمعاينة.</p>
    </div>
  </div>
  <div class="container footer-bottom">
    <p>© <span id="year">2026</span> ${esc(BRAND)}. جميع الحقوق محفوظة.</p>
    <div class="footer-legal">
      <a href="${p}privacy.html">سياسة الخصوصية</a>
      <button class="footer-consent" id="open-consent" type="button" hidden>إعدادات التحليلات</button>
      <span class="demo-tag">بيانات تجريبية</span>
    </div>
  </div>
</footer>`;
}

function tail(prefix) {
  const p = prefix;
  return `<a class="wa-fab" id="wa-fab" href="${p}index.html#contact" aria-label="التواصل عبر واتساب" data-wa-message="مرحبًا Watch Point، أرغب في الاستفسار عن كاميرات المراقبة والأنظمة الأمنية.">
  <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
</a>
<div class="toast" id="toast" role="status" aria-live="polite" hidden>
  <svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg>
  <span id="toast-message"></span>
</div>
<div class="consent-banner" id="consent-banner" role="dialog" aria-modal="false" aria-labelledby="consent-title" hidden>
  <div class="consent-copy">
    <h3 id="consent-title">تحليلات الموقع</h3>
    <p>نستخدم Google Analytics لفهم استخدام الصفحة وتحسين التجربة. لا يتم تحميل التحليلات قبل موافقتك.</p>
  </div>
  <div class="consent-actions">
    <button class="btn btn--primary btn--sm" id="consent-accept" type="button">موافق</button>
    <button class="btn btn--ghost btn--sm" id="consent-decline" type="button">رفض</button>
  </div>
</div>
<script src="${p}js/config.js"></script>
<script src="${p}js/main.js" defer></script>`;
}

/* -------------------------------- Pages ---------------------------------- */

function breadcrumbs(prefix, items) {
  return `<div class="breadcrumbs">
  <div class="container">
    <nav aria-label="مسار التصفح">
      <ol>
        ${items
          .map((item, index) =>
            index === items.length - 1
              ? `<li aria-current="page">${esc(item.label)}</li>`
              : `<li><a href="${item.href}">${esc(item.label)}</a></li>`
          )
          .join("")}
      </ol>
    </nav>
  </div>
</div>`;
}

function categorySchema(category, product) {
  const pagePath = "catalog/" + category.slug + ".html";
  const pageUrl = publicUrl(pagePath, "./" + category.slug + ".html");
  const homeUrl = SITE_URL ? SITE_URL + "/" : "../index.html";
  const catalogUrl = publicUrl("catalog/index.html", "index.html");
  const items = product
    ? [
        {
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "Product",
            name: product.name,
            description: product.description,
            image: publicImage("../", image(product.image)),
            url: pageUrl + "#product",
            category: category.name
          }
        }
      ]
    : [];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "الرئيسية", item: homeUrl },
          { "@type": "ListItem", position: 2, name: "دليل الفئات", item: catalogUrl },
          { "@type": "ListItem", position: 3, name: category.name, item: pageUrl }
        ]
      },
      {
        "@type": "CollectionPage",
        name: category.seo.title,
        description: category.seo.metaDescription,
        url: pageUrl,
        inLanguage: "ar",
        about: { "@type": "Thing", name: category.name },
        mainEntity: {
          "@type": "ItemList",
          name: category.name,
          itemListElement: items
        }
      },
      {
        "@type": "FAQPage",
        mainEntity: category.seo.faq.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a }
        }))
      }
    ]
  };
}

function guideHtml(category) {
  return (category.seo.guide || [])
    .map(
      (section) => `
        <h2>${esc(section.title)}</h2>
        <p>${esc(section.body)}</p>
        ${
          section.bullets && section.bullets.length
            ? `<ul>${section.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join("")}</ul>`
            : ""
        }`
    )
    .join("");
}

function faqHtml(category, openFirst = true) {
  return `<div class="faq-list">
    ${category.seo.faq
      .map(
        (faq, index) => `
          <details class="faq-item"${openFirst && index === 0 ? " open" : ""}>
            <summary>
              <span>${esc(faq.q)}</span>
              <span class="faq-toggle" aria-hidden="true"><svg class="icon"><use href="#icon-chevron-down"/></svg></span>
            </summary>
            <div class="faq-answer"><p>${esc(faq.a)}</p></div>
          </details>`
      )
      .join("")}
  </div>`;
}

function categoryPage(category) {
  const product = productForCategory(category);
  const categoryItems = productsInCategory(category);
  const otherProducts = product
    ? categoryItems.filter((item) => item.id !== product.id)
    : [];
  const related = relatedCategories(category);
  const quoteUrl = `../index.html?product=${encodeURIComponent(product ? product.id : category.id)}#contact`;
  const waMessage =
    "مرحبًا Watch Point، أرغب في طلب عرض سعر لفئة: " + category.name + ".\n\nأرسلت من موقع Watch Point.";
  const priceLabel = product ? productPriceLabel(product) : null;

  const productBlock = product
    ? `<article class="category-product" id="product">
        <div class="category-product-media">
          <img src="${prefixImage("../", product.image)}" alt="${esc(product.imageAlt || product.name)}" width="800" height="600" loading="eager" decoding="async">
        </div>
        <div class="category-product-body">
          ${product.demo ? '<span class="demo-pill"><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg> بيانات تجريبية</span>' : ""}
          <h3><a href="./${esc(productPageFile(product))}">${esc(product.name)}</a></h3>
          <p>${esc(product.description)}</p>
          <ul class="spec-list" aria-label="أبرز مواصفات ومزايا المنتج">
            ${(product.specs || []).map((spec) => `<li><svg class="icon spec-icon" aria-hidden="true"><use href="#icon-check-circle"/></svg><span>${esc(spec)}</span></li>`).join("")}
          </ul>
          <div class="price-row">
            ${renderSeoPriceBox(product)}
          </div>
          <a class="btn btn--primary btn--block" href="${quoteUrl}">
            اطلب عرض سعر
            <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
          </a>
          <a class="btn btn--ghost btn--block" href="./${esc(productPageFile(product))}">
            عرض تفاصيل المنتج
            <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
          </a>
        </div>
      </article>`
    : "";

  const otherProductsBlock = otherProducts.length
    ? `<section class="related-categories">
        <h2>منتجات أخرى في ${esc(category.name)}</h2>
        <div class="related-grid">
          ${otherProducts
            .map(
              (item) => `
                <a class="related-card" href="./${esc(productPageFile(item))}">
                  <strong>${esc(item.name)}</strong>
                  <span>${esc(productPriceLabel(item) || "اطلب آخر سعر")}</span>
                </a>`
            )
            .join("")}
        </div>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>document.documentElement.className = "js";</script>
  <title>${esc(pageTitle(category.seo.title))}</title>
  <meta name="description" content="${esc(category.seo.metaDescription)}">
  <meta name="keywords" content="${esc([...(category.keywords || []), ...(config.seo.keywords || [])].join(", "))}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="${esc(SITE.themeColor || "#0B1B33")}">
  <meta name="geo.region" content="EG">
  <meta name="geo.placename" content="مصر">
  <link rel="canonical" href="${esc(publicUrl("catalog/" + category.slug + ".html", "./" + category.slug + ".html"))}">
  <link rel="alternate" hreflang="ar-EG" href="${esc(publicUrl("catalog/" + category.slug + ".html", "./" + category.slug + ".html"))}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${esc(BRAND)}">
  <meta property="og:locale" content="ar_EG">
  <meta property="og:title" content="${esc(category.seo.title)}">
  <meta property="og:description" content="${esc(category.seo.metaDescription)}">
  <meta property="og:image" content="${esc(publicImage("../", image(SITE.ogImage || "assets/images/og-cover.jpg")))}">
  <meta property="og:url" content="${esc(publicUrl("catalog/" + category.slug + ".html", "./" + category.slug + ".html"))}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(category.seo.title)}">
  <meta name="twitter:description" content="${esc(category.seo.metaDescription)}">
  <meta name="twitter:image" content="${esc(publicImage("../", image(SITE.ogImage || "assets/images/og-cover.jpg")))}">
  <link rel="icon" type="image/x-icon" href="../favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/images/brand-mark-64.png">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/images/icon-192.png">
  <link rel="apple-touch-icon" href="../assets/images/apple-touch-icon.png">
  <link rel="preload" href="../assets/fonts/Dubai-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../css/style.css">
  <script type="application/ld+json">${json(categorySchema(category, product))}</script>
</head>
<body class="subpage">
  ${siteHeader("../")}
  <main id="main-content">
    ${breadcrumbs("../", [
      { label: "الرئيسية", href: "../index.html" },
      { label: "دليل الفئات", href: "index.html" },
      { label: category.name, href: "./" + category.slug + ".html" }
    ])}

    <section class="page-hero${category.image ? " page-hero--with-media" : ""}">
      <div class="container">
        <div class="page-hero-copy">
          <p class="eyebrow eyebrow--light">فئة منتجات</p>
          <h1>${esc(category.seo.h1)}</h1>
          <p>${esc(category.seo.intro)}</p>
          <div class="page-hero-actions">
            <a class="btn btn--primary btn--lg" href="${quoteUrl}">
              اطلب عرض سعر لهذه الفئة
              <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
            </a>
            <a class="btn btn--ghost btn--lg" href="index.html">كل الفئات</a>
          </div>
          <div class="page-hero-meta">
            <span><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg> معاينة قبل التنفيذ</span>
            <span><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg> عرض سعر واضح</span>
            <span><svg class="icon" aria-hidden="true"><use href="#icon-pin"/></svg> خدمة في مصر</span>
          </div>
        </div>
        ${
          category.image
            ? `<figure class="page-hero-media">
                <img src="${prefixImage("../", category.image)}" alt="${esc(category.name)}" loading="eager" decoding="async">
              </figure>`
            : ""
        }
      </div>
    </section>

    <section class="page-body">
      <div class="container page-layout">
        <article class="prose">
          <div class="callout">
            <svg class="icon" aria-hidden="true"><use href="#icon-shield"/></svg>
            <p>${esc(UI.demoNotice || "بيانات المنتجات والأسعار تجريبية. تُحدد المواصفات والسعر النهائي في عرض السعر بعد المعاينة.")}</p>
          </div>

          ${productBlock}

          ${otherProductsBlock}

          <h2>دليل اختيار ${esc(category.name)}</h2>
          ${guideHtml(category)}

          <section id="faq">
            <h2>أسئلة شائعة عن ${esc(category.name)}</h2>
            ${faqHtml(category)}
          </section>

          <section class="related-categories">
            <h2>فئات مرتبطة</h2>
            <div class="related-grid">
              ${related
                .map(
                  (item) => `
                    <a class="related-card" href="./${esc(item.slug)}.html">
                      <strong>${esc(item.name)}</strong>
                      <span>${esc(item.description)}</span>
                    </a>`
                )
                .join("")}
            </div>
          </section>

          <div class="cta-band">
            <h2>تحتاج مساعدة في اختيار النظام؟</h2>
            <p>أرسل تفاصيل المكان والاحتياج، وسنساعدك في تحديد الفئة المناسبة قبل طلب عرض السعر.</p>
            <a class="btn btn--primary" href="${quoteUrl}">
              اطلب عرض سعر
              <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
            </a>
          </div>
        </article>

        <aside>
          <div class="sidebar-card">
            <h2>اطلب عرض سعر</h2>
            <p>لا تحدد السعر قبل معرفة عدد الكاميرات والمساحة ونوع النظام. أرسل التفاصيل وسنراجعها معك.</p>
            <a class="btn btn--primary btn--block" href="${quoteUrl}">اطلب عرض سعر</a>
            <a class="btn btn--whatsapp btn--block" href="../index.html#contact" data-wa-message="${esc(waMessage)}" data-wa-placement="catalog_sidebar" data-wa-item="${esc(category.name)}">
              <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
              تواصل عبر واتساب
            </a>
            <hr>
            <h2>كل الفئات</h2>
            <ul class="sidebar-list">
              ${categories
                .map(
                  (item) => `
                    <li><a href="./${esc(item.slug)}.html">${esc(item.name)}<svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a></li>`
                )
                .join("")}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  </main>
  ${siteFooter("../")}
  ${tail("../")}
</body>
</html>`;
}

function productSchema(product, category) {
  const file = productPageFile(product);
  const pageUrl = publicUrl("catalog/" + file, "./" + file);
  const price = productPriceLabel(product);
  const availability =
    product.availability === "in_stock"
      ? "https://schema.org/InStock"
      : product.availability === "out_of_stock"
        ? "https://schema.org/OutOfStock"
        : null;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "الرئيسية", item: SITE_URL ? SITE_URL + "/" : "../index.html" },
          { "@type": "ListItem", position: 2, name: "دليل الفئات", item: publicUrl("catalog/index.html", "index.html") },
          {
            "@type": "ListItem",
            position: 3,
            name: category.name,
            item: publicUrl("catalog/" + category.slug + ".html", "./" + category.slug + ".html")
          },
          { "@type": "ListItem", position: 4, name: product.name, item: pageUrl }
        ]
      },
      {
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: publicImage("../", image(product.image)),
        sku: product.id,
        category: category.name,
        brand: { "@type": "Brand", name: BRAND },
        url: pageUrl,
        ...(price
          ? {
              offers: {
                "@type": "Offer",
                price: Number(product.price),
                priceCurrency: product.priceCurrency || "EGP",
                availability: availability || "https://schema.org/OnlineOnly",
                url: pageUrl
              }
            }
          : {})
      }
    ]
  };
}

function productPage(product, category) {
  const file = productPageFile(product);
  const pageUrl = publicUrl("catalog/" + file, "./" + file);
  const categoryUrl = "./" + category.slug + ".html";
  const quoteUrl = `../index.html?product=${encodeURIComponent(product.id)}#contact`;
  const priceLabel = productPriceLabel(product);
  const waMessage =
    "مرحبًا Watch Point، أرغب في طلب عرض سعر لهذا المنتج:\n\nالمنتج: " +
    product.name +
    "\nالفئة: " +
    category.name +
    "\n\nأرسلت من موقع Watch Point.";
  const siblings = productsInCategory(category)
    .filter((item) => item.id !== product.id)
    .slice(0, 3);
  const description =
    product.description ||
    `تعرّف على ${product.name} من Watch Point ضمن فئة ${category.name}، مع إمكانية طلب عرض سعر بعد المعاينة.`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>document.documentElement.className = "js";</script>
  <title>${esc(pageTitle(product.name))}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="keywords" content="${esc([...(product.keywords || []), category.name, ...(config.seo.keywords || [])].join(", "))}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="${esc(SITE.themeColor || "#0B1B33")}">
  <meta name="geo.region" content="EG">
  <meta name="geo.placename" content="مصر">
  <link rel="canonical" href="${esc(pageUrl)}">
  <link rel="alternate" hreflang="ar-EG" href="${esc(pageUrl)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="${esc(BRAND)}">
  <meta property="og:locale" content="ar_EG">
  <meta property="og:title" content="${esc(product.name)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(publicImage("../", image(product.image)))}">
  <meta property="og:url" content="${esc(pageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(product.name)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(publicImage("../", image(product.image)))}">
  <link rel="icon" type="image/x-icon" href="../favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/images/brand-mark-64.png">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/images/icon-192.png">
  <link rel="apple-touch-icon" href="../assets/images/apple-touch-icon.png">
  <link rel="preload" href="../assets/fonts/Dubai-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../css/style.css">
  <script type="application/ld+json">${json(productSchema(product, category))}</script>
</head>
<body class="subpage">
  ${siteHeader("../")}
  <main id="main-content">
    ${breadcrumbs("../", [
      { label: "الرئيسية", href: "../index.html" },
      { label: "دليل الفئات", href: "index.html" },
      { label: category.name, href: categoryUrl },
      { label: product.name, href: "./" + file }
    ])}

    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--light"><a href="${categoryUrl}">${esc(category.name)}</a></p>
        <h1>${esc(product.name)}</h1>
        <p>${esc(description)}</p>
        <div class="page-hero-actions">
          <a class="btn btn--primary btn--lg" href="${quoteUrl}">
            اطلب عرض سعر لهذا المنتج
            <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
          </a>
          <a class="btn btn--ghost btn--lg" href="${categoryUrl}">كل ${esc(category.name)}</a>
        </div>
        <div class="page-hero-meta">
          <span><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg> ${esc(priceLabel || UI.priceOnRequestLabel || "اطلب آخر سعر")}</span>
          <span><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg> ${(product.specs || []).length} مواصفة</span>
          <span><svg class="icon" aria-hidden="true"><use href="#icon-pin"/></svg> خدمة في مصر</span>
        </div>
      </div>
    </section>

    <section class="page-body">
      <div class="container page-layout">
        <article class="prose">
          <div class="callout">
            <svg class="icon" aria-hidden="true"><use href="#icon-shield"/></svg>
            <p>${esc(UI.demoNotice || "بيانات المنتجات والأسعار تجريبية. تُحدد المواصفات والسعر النهائي في عرض السعر بعد المعاينة.")}</p>
          </div>

          <div class="category-product">
            <div class="category-product-media">
              <img src="${prefixImage("../", product.image)}" alt="${esc(product.imageAlt || product.name)}" width="800" height="600" loading="eager" decoding="async">
            </div>
            <div class="category-product-body">
              ${product.demo ? '<span class="demo-pill"><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg> بيانات تجريبية</span>' : ""}
              <h3>${esc(product.name)}</h3>
              <p>${esc(product.description)}</p>
              <ul class="spec-list" aria-label="أبرز مواصفات ومزايا المنتج">
                ${(product.specs || []).map((spec) => `<li><svg class="icon spec-icon" aria-hidden="true"><use href="#icon-check-circle"/></svg><span>${esc(spec)}</span></li>`).join("")}
              </ul>
              <div class="price-row">
                ${renderSeoPriceBox(product)}
              </div>
              <a class="btn btn--primary btn--block" href="${quoteUrl}">
                اطلب عرض سعر
                <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
              </a>
            </div>
          </div>

          <h2>أبرز المواصفات والمميزات</h2>
          ${
            (product.specs || []).length
              ? `<ul class="spec-list" aria-label="قائمة المواصفات التفصيلية">
                  ${product.specs.map((spec) => `<li><svg class="icon spec-icon" aria-hidden="true"><use href="#icon-check-circle"/></svg><span>${esc(spec)}</span></li>`).join("")}
                </ul>`
              : "<p>تُؤكد المواصفات التفصيلية للموديل المتاح في عرض السعر بعد مراجعة الاحتياج.</p>"
          }

          ${
            siblings.length
              ? `<section class="related-categories">
                  <h2>منتجات أخرى في ${esc(category.name)}</h2>
                  <div class="related-grid">
                    ${siblings
                      .map(
                        (item) => `
                          <a class="related-card" href="./${esc(productPageFile(item))}">
                            <strong>${esc(item.name)}</strong>
                            <span>${esc(productPriceLabel(item) || "اطلب آخر سعر")}</span>
                          </a>`
                      )
                      .join("")}
                  </div>
                </section>`
              : ""
          }

          <div class="cta-band">
            <h2>تحتاج مساعدة في اختيار المنتج؟</h2>
            <p>أرسل تفاصيل المكان والاحتياج، وسنساعدك في تحديد الموديل والمواصفات المناسبة قبل طلب عرض السعر.</p>
            <a class="btn btn--primary" href="${quoteUrl}">
              اطلب عرض سعر
              <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
            </a>
          </div>
        </article>

        <aside>
          <div class="sidebar-card">
            <h2>اطلب عرض سعر</h2>
            <p>السعر النهائي يعتمد على الموديل والكمية وطريقة التركيب. أرسل التفاصيل وسنراجعها معك.</p>
            <a class="btn btn--primary btn--block" href="${quoteUrl}">اطلب عرض سعر</a>
            <a class="btn btn--whatsapp btn--block" href="../index.html#contact" data-wa-message="${esc(waMessage)}" data-wa-placement="product_sidebar" data-wa-item="${esc(product.name)}">
              <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
              تواصل عبر واتساب
            </a>
            <hr>
            <h2>${esc(category.name)}</h2>
            <ul class="sidebar-list">
              ${productsInCategory(category)
                .map(
                  (item) => `
                    <li><a href="./${esc(productPageFile(item))}">${esc(item.name)}<svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a></li>`
                )
                .join("")}
              <li><a href="${categoryUrl}">صفحة الفئة<svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></a></li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  </main>
  ${siteFooter("../")}
  ${tail("../")}
</body>
</html>`;
}

function catalogIndexPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "الرئيسية", item: SITE_URL ? SITE_URL + "/" : "index.html" },
          { "@type": "ListItem", position: 2, name: "دليل الفئات", item: publicUrl("catalog/index.html", "index.html") }
        ]
      },
      {
        "@type": "CollectionPage",
        name: "دليل فئات منتجات Watch Point",
        description:
          "دليل فئات كاميرات المراقبة والأنظمة الأمنية من Watch Point: كاميرات داخلية وخارجية وIP وWi-Fi وأجهزة تسجيل وتخزين وإنتركم.",
        url: publicUrl("catalog/index.html", "./index.html"),
        inLanguage: "ar",
        mainEntity: {
          "@type": "ItemList",
          itemListElement: categories.map((category, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: category.name,
            url: publicUrl("catalog/" + category.slug + ".html", "./" + category.slug + ".html")
          }))
        }
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>document.documentElement.className = "js";</script>
  <title>${esc(pageTitle("دليل فئات كاميرات المراقبة والأنظمة الأمنية"))}</title>
  <meta name="description" content="دليل فئات منتجات Watch Point: كاميرات مراقبة داخلية وخارجية، كاميرات IP وWi-Fi، أجهزة DVR وNVR، تخزين، كابلات، إنتركم وأكسيس كنترول.">
  <meta name="keywords" content="${esc((config.seo.keywords || []).join(", "))}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="${esc(SITE.themeColor || "#0B1B33")}">
  <link rel="canonical" href="${esc(publicUrl("catalog/index.html", "./index.html"))}">
  <link rel="alternate" hreflang="ar-EG" href="${esc(publicUrl("catalog/index.html", "./index.html"))}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(BRAND)}">
  <meta property="og:locale" content="ar_EG">
  <meta property="og:title" content="دليل فئات منتجات Watch Point">
  <meta property="og:description" content="تعرّف على فئات كاميرات المراقبة والأنظمة الأمنية المتاحة من Watch Point.">
  <meta property="og:image" content="${esc(publicImage("../", image(SITE.ogImage || "assets/images/og-cover.jpg")))}">
  <meta property="og:url" content="${esc(publicUrl("catalog/index.html", "./index.html"))}">
  <link rel="icon" type="image/x-icon" href="../favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/images/brand-mark-64.png">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/images/icon-192.png">
  <link rel="apple-touch-icon" href="../assets/images/apple-touch-icon.png">
  <link rel="preload" href="../assets/fonts/Dubai-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../css/style.css">
  <script type="application/ld+json">${json(schema)}</script>
</head>
<body class="subpage">
  ${siteHeader("../")}
  <main id="main-content">
    ${breadcrumbs("../", [
      { label: "الرئيسية", href: "../index.html" },
      { label: "دليل الفئات", href: "index.html" }
    ])}
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--light">دليل المنتجات</p>
        <h1>فئات كاميرات المراقبة والأنظمة الأمنية</h1>
        <p>ابدأ من الفئة التي تناسب المكان: كاميرات داخلية أو خارجية، أنظمة IP أو Wi-Fi، أجهزة تسجيل وتخزين، أو حلول إنتركم وتحكم في الدخول. كل فئة تحتوي على شرح مبسط وطريقة طلب عرض السعر.</p>
        <div class="page-hero-actions">
          <a class="btn btn--primary btn--lg" href="../index.html#contact">اطلب عرض سعر</a>
          <a class="btn btn--ghost btn--lg" href="../index.html#products">المنتجات على الرئيسية</a>
        </div>
        <div class="page-hero-meta">
          <span><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg> 8 فئات</span>
          <span><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg> بيانات تجريبية قابلة للتعديل</span>
          <span><svg class="icon" aria-hidden="true"><use href="#icon-pin"/></svg> خدمة في مصر</span>
        </div>
      </div>
    </section>

    <section class="page-body">
      <div class="container">
        <div class="prose catalog-intro">
          <div class="callout">
            <svg class="icon" aria-hidden="true"><use href="#icon-shield"/></svg>
            <p>${esc(UI.demoNotice || "")}</p>
          </div>
          <p>هذه الصفحات مصممة لتساعدك على فهم الفروق بين فئات الأنظمة قبل طلب عرض السعر. لا نفترض موديلًا أو سعرًا نهائيًا؛ نراجع المكان والاحتياج ثم نوضح المكونات المناسبة.</p>
        </div>

        <div class="catalog-page-grid">
          ${categories
            .map(
              (category) => `
                <a class="catalog-tile" href="./${esc(category.slug)}.html">
                  <div class="catalog-tile-media">
                    <img src="${prefixImage("../", category.image)}" alt="${esc(category.name)}" loading="lazy" decoding="async">
                  </div>
                  <div class="catalog-tile-body">
                    <h2>${esc(category.name)}</h2>
                    <p>${esc(category.description)}</p>
                    <span class="catalog-tile-link">استعرض الفئة <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg></span>
                  </div>
                </a>`
            )
            .join("")}
        </div>

        <div class="cta-band">
          <h2>مش متأكد من الفئة المناسبة؟</h2>
          <p>أرسل لنا نوع المكان والمساحة التقريبية، وسنساعدك في تحديد الفئات المطلوبة قبل طلب العرض.</p>
          <a class="btn btn--primary" href="../index.html#contact">
            اطلب استشارة
            <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
          </a>
        </div>
      </div>
    </section>
  </main>
  ${siteFooter("../")}
  ${tail("../")}
</body>
</html>`;
}

function privacyPage() {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>document.documentElement.className = "js";</script>
  <title>${esc(pageTitle("سياسة الخصوصية"))}</title>
  <meta name="description" content="سياسة الخصوصية في موقع Watch Point: كيف نتعامل مع بيانات نموذج عرض السعر، واتساب، وGoogle Analytics، وخيارات الموافقة.">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="${esc(SITE.themeColor || "#0B1B33")}">
  <link rel="canonical" href="${esc(publicUrl("privacy.html", "./privacy.html"))}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(BRAND)}">
  <meta property="og:locale" content="ar_EG">
  <meta property="og:title" content="سياسة الخصوصية | Watch Point">
  <meta property="og:description" content="كيف يتعامل موقع Watch Point مع بيانات التواصل والتحليلات.">
  <meta property="og:image" content="${esc(publicImage("", image(SITE.ogImage || "assets/images/og-cover.jpg")))}">
  <meta property="og:url" content="${esc(publicUrl("privacy.html", "./privacy.html"))}">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="assets/images/brand-mark-64.png">
  <link rel="icon" type="image/png" sizes="192x192" href="assets/images/icon-192.png">
  <link rel="apple-touch-icon" href="assets/images/apple-touch-icon.png">
  <link rel="preload" href="assets/fonts/Dubai-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="css/style.css">
</head>
<body class="subpage">
  ${siteHeader("")}
  <main id="main-content">
    ${breadcrumbs("", [
      { label: "الرئيسية", href: "index.html" },
      { label: "سياسة الخصوصية", href: "privacy.html" }
    ])}
    <div class="container">
      <article class="privacy-content">
        <p class="eyebrow">الخصوصية</p>
        <h1>سياسة الخصوصية</h1>
        <p>آخر تحديث: نوفمبر 2026</p>

        <h2>1. البيانات التي تدخلها في النموذج</h2>
        <p>نموذج طلب عرض السعر يطلب الاسم ورقم الهاتف واختيار المنتج أو الباقة والملاحظات الاختيارية. هذه البيانات لا تُرسل إلى خادم تابع لموقع Watch Point في النسخة الحالية، ولا يتم تخزينها في قاعدة بيانات.</p>
        <p>عند الضغط على زر الإرسال، يتم تجهيز رسالة واتساب تحتوي بياناتك وفتح تطبيق أو موقع واتساب. إرسال الرسالة يتم من خلال حسابك على واتساب، وتخضع البيانات لسياسة خصوصية واتساب.</p>

        <h2>2. التحليلات وGoogle Analytics</h2>
        <p>لا يتم تحميل Google Analytics افتراضيًا. إذا تم ضبط معرّف القياس في ملف الإعدادات، سيظهر خيار موافقة. عند الموافقة، قد يجمع Google Analytics بيانات استخدام مثل الصفحات التي تمت زيارتها والأحداث التفاعلية، مع تفعيل إخفاء عنوان IP. يمكنك رفض التحليلات أو تغيير اختيارك من رابط «إعدادات التحليلات» في التذييل.</p>

        <h2>3. التخزين المحلي</h2>
        <p>نستخدم التخزين المحلي في متصفحك لحفظ اختيارك بشأن التحليلات فقط. لا نستخدمه لتخزين بيانات النموذج أو رقم الهاتف.</p>

        <h2>4. خدمات خارجية</h2>
        <ul>
          <li>واتساب: عند فتح رابط واتساب أو إرسال رسالة، تُطبق سياسة خصوصية Meta/WhatsApp.</li>
          <li>Google Analytics: عند الموافقة فقط، وتُطبق سياسة خصوصية Google.</li>
        </ul>

        <h2>5. حقوقك</h2>
        <p>يمكنك طلب معرفة أو تصحيح البيانات التي أرسلتها عبر واتساب بالتواصل مع الشركة على الرقم المعتمد. كما يمكنك حذف اختيار التحليلات من إعدادات المتصفح.</p>

        <h2>6. التواصل</h2>
        <p>لأي استفسار عن الخصوصية، استخدم وسيلة التواصل المعتمدة على الموقع. لا نعرض عنوانًا أو رقمًا غير مؤكد، ويتم تحديث بيانات التواصل من ملف إعدادات الموقع عند اعتمادها.</p>
      </article>
    </div>
  </main>
  ${siteFooter("")}
  ${tail("")}
</body>
</html>`;
}

/* ----------------------------- Files output ------------------------------ */

const catalogDir = path.join(ROOT, "catalog");
fs.mkdirSync(catalogDir, { recursive: true });

let count = 0;
for (const category of categories) {
  if (!category.slug) throw new Error("Category slug missing: " + category.id);
  fs.writeFileSync(path.join(catalogDir, category.slug + ".html"), categoryPage(category), "utf8");
  count += 1;
}

let productCount = 0;
for (const product of products) {
  const category = categoryById(product.categoryId);
  if (!category || !product.slug) continue;
  fs.writeFileSync(path.join(catalogDir, productPageFile(product)), productPage(product, category), "utf8");
  productCount += 1;
}

fs.writeFileSync(path.join(catalogDir, "index.html"), catalogIndexPage(), "utf8");
fs.writeFileSync(path.join(ROOT, "privacy.html"), privacyPage(), "utf8");

const catalogSnapshot = {
  generatedAt: TODAY,
  source: SITE_URL || "local",
  note: "بيانات تجريبية. يمكن استبدالها بـ Django REST API عبر js/config.js → data.source = 'api'.",
  categories,
  products,
  packages
};
fs.writeFileSync(path.join(catalogDir, "catalog.json"), JSON.stringify(catalogSnapshot, null, 2), "utf8");

const pages = [
  { path: "", priority: "1.0", changefreq: "weekly" },
  { path: "catalog/index.html", priority: "0.9", changefreq: "weekly" },
  ...categories.map((category) => ({
    path: "catalog/" + category.slug + ".html",
    priority: "0.8",
    changefreq: "monthly"
  })),
  ...products
    .filter((product) => product.slug && categoryById(product.categoryId))
    .map((product) => ({
      path: "catalog/" + productPageFile(product),
      priority: "0.7",
      changefreq: "monthly"
    })),
  { path: "privacy.html", priority: "0.3", changefreq: "yearly" }
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- استبدل ${BASE} بالنطاق الفعلي قبل النشر. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${BASE}/${page.path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");

const robots = `# Watch Point — robots.txt
# استبدل ${BASE} بالنطاق الفعلي قبل النشر.
User-agent: *
Allow: /
Disallow: /tools/

# AI / answer engines are welcome to read public pages.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: ${BASE}/sitemap.xml
`;
fs.writeFileSync(path.join(ROOT, "robots.txt"), robots, "utf8");

const phoneLine = CONTACT.phoneDisplay || CONTACT.phone || "غير مضبوط بعد — يُضاف من config.js";
const emailLine = CONTACT.email || "غير مضبوط بعد — يُضاف من config.js";
const llms = `# Watch Point

> ${COMPANY.description || "توريد وتركيب كاميرات المراقبة والأنظمة الأمنية في مصر."}

## الحقائق الأساسية
- الاسم: ${BRAND}
- المجال: كاميرات مراقبة وأنظمة أمنية وحلول مراقبة.
- نطاق الخدمة: ${CONTACT.serviceArea || "مصر"}.
- الجمهور: منازل، محلات، شركات، مكاتب.
- الخدمات: معاينة الموقع، توريد الأنظمة، التركيب والبرمجة، الصيانة والدعم.
- طريقة التسعير: عرض سعر بعد معرفة الاحتياجات والمعاينة، وليس سعرًا ثابتًا مسبقًا.
- الهاتف: ${phoneLine}
- البريد: ${emailLine}
- واتساب: ${CONTACT.whatsappNumber ? "+" + CONTACT.whatsappNumber : "غير مضبوط بعد — يُضاف من config.js"}

## الصفحات
${pages
  .map((page) => `- [${page.path || "الصفحة الرئيسية"}](${BASE}/${page.path})`)
  .join("\n")}

## ملاحظات مهمة
- بيانات المنتجات والأسعار في النسخة الحالية تجريبية وقابلة للتعديل.
- لا يتم عرض مخزون أو سعر نهائي إلا عند وجود مصدر بيانات فعلي.
- الموقع لا يدّعي وجود تقييمات أو شهادات عملاء أو شركاء غير مؤكدة.
- المحتوى متاح بالعربية (ar-EG) واتجاه RTL.

## الاستشهاد
عند الاقتباس من هذا الموقع، يُشار إلى "${BRAND}" مع رابط الصفحة المستخدمة.
`;
fs.writeFileSync(path.join(ROOT, "llms.txt"), llms, "utf8");

console.log(`Generated: catalog/index.html + ${count} category pages + ${productCount} product pages`);
console.log("Generated: privacy.html, catalog/catalog.json, sitemap.xml, robots.txt, llms.txt");
console.log(`Canonical base: ${BASE}`);
if (!SITE_URL) {
  console.warn(
    "WARNING: config.site.url is empty. sitemap.xml, robots.txt and llms.txt use the placeholder domain.\n" +
    "Set site.url in js/config.js to your live domain, then run this generator again."
  );
}
