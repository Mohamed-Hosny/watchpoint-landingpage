/* ==========================================================================
   Watch Point Admin — data store
   --------------------------------------------------------------------------
   Source of truth: admin/data/store.json
   It is seeded once from js/data.js + js/config.js, then the admin panel
   writes js/data.js and regenerates the SEO pages on "publish".
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ADMIN_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(ADMIN_DIR, "..");
export const DATA_DIR = path.join(ADMIN_DIR, "data");
export const UPLOAD_DIR = path.join(ROOT, "assets", "images", "uploads");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function loadSiteSource() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readText("js/config.js"), context, { filename: "js/config.js" });
  vm.runInContext(readText("js/data.js"), context, { filename: "js/data.js" });

  const config = context.window.WP_CONFIG || {};
  const categories = context.window.WP_CATEGORIES || [];
  const products = context.window.WP_PRODUCTS || [];
  const packages = context.window.WP_PACKAGES || [];

  if (!Array.isArray(categories) || !categories.length) {
    throw new Error("لم يتم العثور على فئات في js/data.js");
  }

  return { config, categories, products, packages };
}

function settingsFromConfig(config) {
  const contact = config.contact || {};
  return {
    siteUrl: config.site?.url || "",
    whatsappNumber: contact.whatsappNumber || "",
    phone: contact.phone || "",
    phoneDisplay: contact.phoneDisplay || "",
    email: contact.email || "",
    address: contact.address || "",
    serviceArea: contact.serviceArea || "",
    workingHours: contact.workingHours || "",
    measurementId: config.analytics?.measurementId || ""
  };
}

function writeJsonAtomic(file, value) {
  ensureDirs();
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

const DEFAULT_BANNERS = [
  {
    id: "banner-main-smart-home",
    slot: "main",
    title: "أمّن كل مساحة",
    highlight: "مساحة",
    subtitle: "اضغط على أي نقطة مضيئة في المنزل للانتقال مباشرة إلى المنتج أو القسم المخصص",
    badge: "منزل ذكي مؤمّن بالكامل",
    image: "assets/images/banners/banner-main-smart-home.webp",
    link: "#store",
    buttonText: "استكشف أنظمة الحماية",
    showOverlay: false,
    hotspots: [
      {
        x: 88.5,
        y: 68.5,
        label: "كاميرا خارجي PTZ متحركة — هيكفجن",
        sublabel: "DS-2AE4425ITG · تتبع وزووم ذكي للبوابات",
        productId: "prod-mw4uttfs-3c7e21",
        link: "#product:prod-mw4uttfs-3c7e21"
      },
      {
        x: 89.2,
        y: 44.5,
        label: "كاميرا مراقبة خارجية 3K بصوت ثنائي",
        sublabel: "DS-2CE78K0T-LPTS · لتأمين الجراج والأسوار",
        productId: "prod-mw4vfgcg-6557d6",
        link: "#product:prod-mw4vfgcg-6557d6"
      },
      {
        x: 10.8,
        y: 24.8,
        label: "كاميرا خارجية ليلية مقاومة للعوامل الجوية",
        sublabel: "DS-2CE78K0T-LPTS · تغطية المحيط الخارجي",
        productId: "prod-mw4vfgcg-6557d6",
        link: "#product:prod-mw4vfgcg-6557d6"
      },
      {
        x: 49.3,
        y: 37.8,
        label: "كاميرا داخلي 2 ميجا كلر فيو هيكفجن",
        sublabel: "DS-2CE70DF0T-LPFS · تصوير ملون 24/7 بالصوت",
        productId: "prod-mw4uxyot-23221c",
        link: "#product:prod-mw4uxyot-23221c"
      },
      {
        x: 27.6,
        y: 48.2,
        label: "كاميرا داخلية لتغطية الصالة والريسبشن",
        sublabel: "DS-2CE70DF0T-LPFS · زاوية عريضة 105°",
        productId: "prod-mw4uxyot-23221c",
        link: "#product:prod-mw4uxyot-23221c"
      },
      {
        x: 75.6,
        y: 42.6,
        label: "جهاز تسجيل الشبكة 16 قناة 4K NVR",
        sublabel: "Hikvision DS-7616NXI-K2 · ذكاء اصطناعي AcuSense",
        productId: "wp-16-ch",
        link: "#product:wp-16-ch"
      },
      {
        x: 61.3,
        y: 63.8,
        label: "قفل باب ذكي ببصمة الوجه 3D والشاشة",
        sublabel: "EZVIZ DL50FVS · فتح بـ 7 طرق ذكية",
        productId: "wp-smartlock-accesscontrol",
        link: "#product:wp-smartlock-accesscontrol"
      },
      {
        x: 69.8,
        y: 60.5,
        label: "إنتركم فيديو ذكي وشاشة تحكم جدارية",
        sublabel: "مشاهدة الزائر وفتح الباب من الشاشة أو الموبايل",
        categoryId: "intercom",
        subcatId: "intercom-video",
        link: "#subcat:intercom:intercom-video"
      },
      {
        x: 50.0,
        y: 50.8,
        label: "راوتر وشبكة واي فاي مركزية",
        sublabel: "ربط جميع الكاميرات والأجهزة الذكية بسرعة فائقة",
        categoryId: "networks",
        subcatId: "net-routers",
        link: "#subcat:networks:net-routers"
      },
      {
        x: 36.8,
        y: 28.2,
        label: "أكسيس بوينت ومقوي إشارة Wi-Fi",
        sublabel: "تغطية لاسلكية كاملة لجميع الغرف والطوابق",
        categoryId: "networks",
        subcatId: "net-access-point",
        link: "#subcat:networks:net-access-point"
      },
      {
        x: 55.2,
        y: 23.2,
        label: "شاشات عرض ومراقبة تخصصية 24/7",
        sublabel: "شاشات عالية الدقة لمتابعة الكاميرات",
        categoryId: "screens",
        subcatId: "screens-displays",
        link: "#cat:screens"
      },
      {
        x: 37.2,
        y: 55.5,
        label: "أنظمة صوتيات وسماعات داخلية",
        sublabel: "توزيع صوتي نقي للمنازل والشركات",
        categoryId: "audio",
        subcatId: "audio-speakers",
        link: "#cat:audio"
      }
    ]
  },
  {
    id: "banner-right-smartcam",
    slot: "right",
    title: "كاميرات واي فاي وإنتركم ذكي",
    subtitle: "متابعة مباشرة من الموبايل بدقة فائقة",
    badge: "حماية ذكية",
    image: "assets/images/banners/banner-side-smartcam.webp",
    link: "#cat:intercom",
    showOverlay: false
  },
  {
    id: "banner-right-ptz",
    slot: "right",
    title: "كاميرات PTZ متحركة",
    subtitle: "تغطية شاملة وزووم بصري فائق",
    badge: "كاميرات احترافية",
    image: "assets/images/banners/banner-side-ptz.webp",
    link: "#cat:cctv",
    showOverlay: true
  },
  {
    id: "banner-left-audio",
    slot: "left",
    title: "أنظمة صوتيات وإذاعة داخلية",
    subtitle: "مكبرات صوت وسماعات للمنشآت والمساجد والشركات",
    badge: "صوتيات",
    image: "assets/images/banners/banner-side-audio.webp",
    link: "#cat:audio",
    showOverlay: false
  },
  {
    id: "banner-left-nvr",
    slot: "left",
    title: "أجهزة تسجيل NVR 4K",
    subtitle: "تحليل ذكي وتخزين مستمر بأعلى أمان",
    badge: "أجهزة تسجيل",
    image: "assets/images/banners/banner-side-nvr.webp",
    link: "#cat:cctv",
    showOverlay: true
  }
];

export function getStore() {
  ensureDirs();
  if (!fs.existsSync(STORE_FILE)) {
    const source = loadSiteSource();
    const now = new Date().toISOString();
    const store = {
      version: 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      settings: settingsFromConfig(source.config),
      categories: source.categories,
      products: source.products,
      packages: source.packages,
      banners: DEFAULT_BANNERS
    };
    writeJsonAtomic(STORE_FILE, store);
    return store;
  }

  const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  raw.categories = Array.isArray(raw.categories) ? raw.categories : [];
  raw.products = Array.isArray(raw.products) ? raw.products : [];
  raw.packages = Array.isArray(raw.packages) ? raw.packages : [];
  raw.brands = Array.isArray(raw.brands) ? raw.brands : [];
  if (!Array.isArray(raw.banners)) {
    raw.banners = DEFAULT_BANNERS;
  } else {
    const mainBanner = raw.banners.find((b) => b.id === "banner-main-smart-home");
    if (mainBanner && (!Array.isArray(mainBanner.hotspots) || mainBanner.hotspots.length < 10)) {
      mainBanner.hotspots = DEFAULT_BANNERS[0].hotspots;
      mainBanner.image = DEFAULT_BANNERS[0].image;
    }
  }
  raw.settings = raw.settings || {};
  return raw;
}

export function saveStore(store, { touch = true } = {}) {
  if (touch) store.updatedAt = new Date().toISOString();
  writeJsonAtomic(STORE_FILE, store);
  try {
    const dataPath = path.join(ROOT, "js", "data.js");
    writeTextAtomic(dataPath, buildDataJs(store));
    if (touch) {
      const res = spawnSync(process.execPath, ["tools/generate-seo.mjs"], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 60000
      });
      if (res.status === 0) {
        store.publishedAt = store.updatedAt;
        writeJsonAtomic(STORE_FILE, store);
      }
    }
  } catch (error) {
    console.warn("[admin] auto-sync data.js skipped:", error.message);
  }
  return store;
}

export function resetStoreFromSite() {
  if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);
  return getStore();
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupFile(relativePath, label) {
  try {
    const source = path.join(ROOT, relativePath);
    if (!fs.existsSync(source)) return;
    ensureDirs();
    const target = path.join(BACKUP_DIR, `${label}-${timestamp()}.bak`);
    fs.copyFileSync(source, target);
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => name.startsWith(label + "-"))
      .sort();
    while (files.length > 10) {
      const old = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
  } catch (error) {
    console.warn("[admin] backup skipped:", error.message);
  }
}

function writeTextAtomic(file, content) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

function buildDataJs(store) {
  return `/* ==========================================================================
   Watch Point — بيانات الكتالوج
   --------------------------------------------------------------------------
   هذا الملف مُولَّد تلقائيًا من لوحة التحكم (admin).
   لا تعدّله يدويًا؛ استخدم اللوحة ثم اضغط "نشر التغييرات".
   آخر تحديث: ${new Date().toISOString()}
   ========================================================================== */

window.WP_CATEGORIES = ${JSON.stringify(store.categories, null, 2)};

window.WP_PRODUCTS = ${JSON.stringify(store.products, null, 2)};

window.WP_PACKAGES = ${JSON.stringify(store.packages, null, 2)};

window.WP_BRANDS = ${JSON.stringify(store.brands || [], null, 2)};

window.WP_BANNERS = ${JSON.stringify(store.banners || [], null, 2)};
`;
}

function replaceBlockValue(source, blockName, key, value) {
  const blockPattern = new RegExp(`(\\n  ${blockName}: \\{)([\\s\\S]*?)(\\n  \\})`);
  const match = source.match(blockPattern);
  if (!match) throw new Error(`لم يتم العثور على القسم ${blockName} في js/config.js`);

  const keyPattern = new RegExp(`(\\n    ${key}: )("[^"\\n]*"|'[^'\\n]*'|[^,\\n]+)`);
  if (!keyPattern.test(match[2])) {
    throw new Error(`لم يتم العثور على ${blockName}.${key} في js/config.js`);
  }

  const newBody = match[2].replace(keyPattern, `$1${JSON.stringify(String(value ?? ""))}`);
  return source.replace(blockPattern, `$1${newBody}$3`);
}

function patchConfig(source, settings) {
  let output = source;
  output = replaceBlockValue(output, "site", "url", settings.siteUrl || "");
  output = replaceBlockValue(output, "contact", "whatsappNumber", settings.whatsappNumber || "");
  output = replaceBlockValue(output, "contact", "phone", settings.phone || "");
  output = replaceBlockValue(output, "contact", "phoneDisplay", settings.phoneDisplay || "");
  output = replaceBlockValue(output, "contact", "email", settings.email || "");
  output = replaceBlockValue(output, "contact", "address", settings.address || "");
  output = replaceBlockValue(output, "contact", "serviceArea", settings.serviceArea || "");
  output = replaceBlockValue(output, "contact", "workingHours", settings.workingHours || "");
  output = replaceBlockValue(output, "analytics", "measurementId", settings.measurementId || "");
  return output;
}

export function publish(store) {
  ensureDirs();

  if (!store.categories.length) {
    return { ok: false, error: "لا توجد فئات للنشر.", log: "" };
  }
  if (!store.products.length && !store.packages.length) {
    return { ok: false, error: "لا توجد منتجات أو باقات للنشر.", log: "" };
  }

  const dataPath = path.join(ROOT, "js", "data.js");
  const configPath = path.join(ROOT, "js", "config.js");
  const originalData = fs.readFileSync(dataPath, "utf8");
  const originalConfig = fs.readFileSync(configPath, "utf8");

  backupFile("js/data.js", "data");
  backupFile("js/config.js", "config");

  try {
    writeTextAtomic(dataPath, buildDataJs(store));
    writeTextAtomic(configPath, patchConfig(originalConfig, store.settings));
  } catch (error) {
    writeTextAtomic(dataPath, originalData);
    writeTextAtomic(configPath, originalConfig);
    return { ok: false, error: `تعذر حفظ الملفات: ${error.message}`, log: "" };
  }

  const result = spawnSync(process.execPath, ["tools/generate-seo.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120000
  });

  const log = [result.stdout || "", result.stderr || ""].filter(Boolean).join("\n").trim();

  if (result.status !== 0) {
    writeTextAtomic(dataPath, originalData);
    writeTextAtomic(configPath, originalConfig);
    return {
      ok: false,
      error: "فشل توليد صفحات SEO. تم التراجع عن آخر تغيير في الملفات.",
      log
    };
  }

  store.publishedAt = new Date().toISOString();
  saveStore(store, { touch: false });

  // Remove stale category/product pages left over after a slug rename or delete.
  try {
    const catalogDir = path.join(ROOT, "catalog");
    const valid = new Set([
      "index.html",
      ...store.categories.map((category) => `${category.slug}.html`),
      ...store.products
        .filter((product) => product.slug)
        .map((product) => `product-${String(product.slug).replace(/[^a-z0-9-]/gi, "-")}.html`)
    ]);
    for (const file of fs.readdirSync(catalogDir)) {
      if (file.endsWith(".html") && !valid.has(file)) {
        fs.unlinkSync(path.join(catalogDir, file));
      }
    }
  } catch (error) {
    console.warn("[admin] stale catalog cleanup skipped:", error.message);
  }

  return { ok: true, error: null, log: log || "تم التوليد بنجاح." };
}

export function hasPendingChanges(store) {
  if (!store.publishedAt) return true;
  return new Date(store.updatedAt).getTime() > new Date(store.publishedAt).getTime() + 999;
}

export function counts(store) {
  return {
    products: store.products.length,
    packages: store.packages.length,
    categories: store.categories.length,
    brands: (store.brands || []).length,
    banners: (store.banners || []).length,
    featured: store.products.filter((item) => item.featured).length
  };
}
