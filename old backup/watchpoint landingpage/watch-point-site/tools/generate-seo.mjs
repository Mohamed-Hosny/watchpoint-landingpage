/* ==========================================================================
   Watch Point — Advanced Programmatic SEO, GEO & AEO Generator
   Generates:
   - catalog/index.html (Main Security Systems Catalog)
   - catalog/<slug>.html (Individual Category Deep Dives with Local SEO)
   - catalog/catalog.json (ERP-ready API payload)
   - sitemap.xml (Complete Multi-page XML Sitemap)
   - robots.txt (Crawler Guidance & AI Agent Rules)
   - llms.txt (Optimized context for AEO & AI Search Engines like Perplexity/GPT)
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TODAY = new Date().toISOString().slice(0, 10);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function loadContext() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(read("js/config.js"), ctx);
  vm.runInContext(read("js/data.js"), ctx);
  return {
    config: ctx.window.WP_CONFIG,
    categories: ctx.window.WP_CATEGORIES,
    products: ctx.window.WP_PRODUCTS,
    packages: ctx.window.WP_PACKAGES
  };
}

const { config, categories, products, packages } = loadContext();
const CATALOG_DIR = path.join(ROOT, "catalog");
if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });

/* --------------------------------------------------------------------------
   1. Generate Sitemap.xml
   -------------------------------------------------------------------------- */
const siteUrl = config.site.url || "https://watchpoint-eg.com";
let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/catalog/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;

categories.forEach(cat => {
  sitemapContent += `
  <url>
    <loc>${siteUrl}/catalog/${cat.slug}.html</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
});

sitemapContent += `\n</urlset>`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemapContent.trim());
console.log("✓ sitemap.xml generated");

/* --------------------------------------------------------------------------
   2. Generate robots.txt
   -------------------------------------------------------------------------- */
const robotsContent = `User-agent: *
Allow: /
Disallow: /tools/

Sitemap: ${siteUrl}/sitemap.xml
`;
fs.writeFileSync(path.join(ROOT, "robots.txt"), robotsContent.trim());
console.log("✓ robots.txt generated");

/* --------------------------------------------------------------------------
   3. Generate llms.txt (AEO - Answer Engine Optimization)
   -------------------------------------------------------------------------- */
const llmsContent = `# Watch Point — Integrated Security Solutions

> الشركة الهندسية المتخصصة في توريد وتركيب كاميرات المراقبة، أجهزة التسجيل DVR و NVR، شبكات IP، والتحكم في الدخول في مصر.

## نبذة عن الشركة
- الاسم: Watch Point (ووتش بوينت للأنظمة الأمنية)
- الهوية البصرية: Modern Security Blue (أزرق تقني، كحلي الأمان، أبيض)
- التغطية الجغرافية: القاهرة، الجيزة، والإسكندرية وجميع محافظات جمهورية مصر العربية
- الهاتف المعتمد: 01000000000
- واتساب: +201000000000
- البريد الرسمي: info@watchpoint-eg.com

## الخدمات الأساسية
1. **معاينة مجانية للموقع**: فحص المساحة وتحديد زوايا الرؤية والكاميرات المناسبة.
2. **توريد الأجهزة الأصلية**: كاميرات مراقبة Hikvision, Dahua, Tiandy, هاردات WD Purple.
3. **التركيب والبرمجة**: مسارات كابلات احترافية مخفية وضبط المشاهدة على الهاتف الذكي.
4. **عقود الصيانة والدعم الفني**: خدمة ما بعد البيع واستجابة سريعة للأعطال.

## الفئات والمنتجات الرئيسية
${categories.map(c => `- **${c.name}** (${c.plural}): ${c.description}`).join("\n")}

## باقات التركيب المعتمدة
${packages.map(p => `- **${p.name}**: تبدأ من ${p.price} ج.م تشمل الكاميرات وجهاز التسجيل والهارد والتمديدات والبرمجة والضمان.`).join("\n")}
`;
fs.writeFileSync(path.join(ROOT, "llms.txt"), llmsContent.trim());
console.log("✓ llms.txt generated");

/* --------------------------------------------------------------------------
   4. Generate catalog.json (ERP Ready Architecture)
   -------------------------------------------------------------------------- */
const catalogJson = {
  version: "1.0",
  updatedAt: TODAY,
  company: config.company,
  categories,
  products,
  packages
};
fs.writeFileSync(path.join(CATALOG_DIR, "catalog.json"), JSON.stringify(catalogJson, null, 2));
console.log("✓ catalog/catalog.json generated");

/* --------------------------------------------------------------------------
   5. Generate Category Pages for Programmatic SEO
   -------------------------------------------------------------------------- */
categories.forEach(cat => {
  const catProducts = products.filter(p => p.categoryId === cat.id);
  const pageHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cat.seo.title || cat.name + " | Watch Point"}</title>
  <meta name="description" content="${cat.seo.metaDescription || cat.description}">
  <meta name="keywords" content="${cat.keywords.join(", ")}">
  <link rel="canonical" href="${siteUrl}/catalog/${cat.slug}.html">
  <link rel="stylesheet" href="../css/vendor/bootstrap.min.css">
  <link rel="stylesheet" href="../css/style.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ProductCategory",
    "name": "${cat.name}",
    "description": "${cat.description}",
    "url": "${siteUrl}/catalog/${cat.slug}.html",
    "provider": {
      "@type": "Organization",
      "name": "Watch Point"
    }
  }
  </script>
</head>
<body style="background-color: var(--wp-bg-soft);">
  <header class="site-header">
    <div class="wrap">
      <div class="header-main">
        <a href="../index.html" class="brand-logo-wrap">
          <img src="../assets/images/brand/logo-128h.webp" alt="Watch Point Logo" class="brand-logo-img">
          <div class="brand-text-block">
            <span class="brand-name">WATCH <span>POINT</span></span>
            <span class="brand-tagline">Integrated Security Solutions</span>
          </div>
        </a>
        <div class="header-actions">
          <a href="../index.html" class="btn-wp btn-wp-outline btn-wp-sm">الرئيسية</a>
          <a href="https://wa.me/201000000000" target="_blank" rel="noopener" class="btn-wp btn-wp-whatsapp btn-wp-sm">استشارة فنية عبر واتساب</a>
        </div>
      </div>
    </div>
  </header>

  <main class="section-wp">
    <div class="wrap">
      <nav aria-label="مسار التنقل" style="margin-bottom: 24px; font-size: 0.88rem;">
        <a href="../index.html" style="color: var(--wp-text-muted);">الرئيسية</a> &gt; 
        <a href="index.html" style="color: var(--wp-text-muted);">الأنظمة والمنتجات</a> &gt; 
        <span style="color: var(--wp-deep-security-blue); font-weight: 700;">${cat.name}</span>
      </nav>

      <div style="background: #fff; padding: 40px; border-radius: var(--wp-radius-xl); border: 1.5px solid var(--wp-border); margin-bottom: 40px;">
        <h1 style="color: var(--wp-deep-security-blue); font-size: 2.2rem; margin-bottom: 14px;">${cat.seo.h1 || cat.plural}</h1>
        <p style="color: var(--wp-text-muted); font-size: 1.1rem; line-height: 1.8; max-width: 70ch;">${cat.seo.intro || cat.description}</p>
      </div>

      <div class="section-head-wp">
        <h2>الموديلات المتاحة في هذا القسم</h2>
      </div>

      <div class="pgrid-wp">
        ${catProducts.map(p => `
          <article class="pcard-wp">
            <div class="pcard-frame">
              <img src="../${p.image}" alt="${p.name}" loading="lazy">
            </div>
            <div class="pcard-body">
              <h3 class="pcard-title"><a href="../product.html?id=${p.id}">${p.name}</a></h3>
              <div class="pcard-price-row">
                <span class="pcard-price">${p.price ? p.price + " ج.م" : "طلب عرض سعر"}</span>
              </div>
              <a href="https://wa.me/201000000000?text=${encodeURIComponent('مرحبًا Watch Point، أرغب في الاستفسار عن: ' + p.name)}" target="_blank" rel="noopener" class="btn-wp btn-wp-primary btn-wp-sm w-100">
                طلب عرض سعر
              </a>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  </main>

  <footer class="site-footer-wp" style="padding-top: 30px;">
    <div class="wrap text-center">
      <p>© 2026 Watch Point — Integrated Security Solutions. جميع الحقوق محفوظة.</p>
    </div>
  </footer>
</body>
</html>`;

  fs.writeFileSync(path.join(CATALOG_DIR, `${cat.slug}.html`), pageHtml);
});

console.log("✓ All category pages generated successfully.");
