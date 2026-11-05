/* ==========================================================================
   Watch Point Admin — local server
   Serves the public static site AND the Arabic admin panel.
   Run: node admin/server.mjs [--port=8123]
   ========================================================================== */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";

import {
  ROOT,
  UPLOAD_DIR,
  getStore,
  saveStore,
  publish,
  hasPendingChanges,
  counts
} from "./store.mjs";

import {
  isConfigured,
  setPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  sessionCookie,
  clearCookie
} from "./auth.mjs";

import {
  setupPage,
  loginPage,
  dashboardPage,
  productsPage,
  productFormPage,
  packagesPage,
  packageFormPage,
  categoriesPage,
  categoryFormPage,
  settingsPage,
  publishResultPage,
  messageFromQuery,
  errorPage,
  escapeHtml
} from "./views.mjs";

const ADMIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ADMIN_DIR, "public");

const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const PORT = Number(process.env.PORT || (portArg ? portArg.split("=")[1] : 0) || 8123);
const HOST = process.env.HOST || "127.0.0.1";

const MAX_BODY = 12 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

const loginAttempts = new Map();

/* ------------------------------------------------------------------ helpers */

function send(res, status, html, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extraHeaders
  });
  res.end(html);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store", ...headers });
  res.end();
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 — الصفحة غير موجودة");
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) reject(new Error("BODY_TOO_LARGE"));
      else resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!boundaryMatch) throw new Error("INVALID_MULTIPART");
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = [];

  let position = buffer.indexOf(delimiter);
  while (position !== -1) {
    position += delimiter.length;
    if (buffer.slice(position, position + 2).toString("latin1") === "--") break;
    if (buffer[position] === 13 && buffer[position + 1] === 10) position += 2;

    const headerEnd = buffer.indexOf("\r\n\r\n", position);
    if (headerEnd === -1) break;
    const rawHeaders = buffer.slice(position, headerEnd).toString("utf8");
    const next = buffer.indexOf(delimiter, headerEnd + 4);
    if (next === -1) break;

    let content = buffer.slice(headerEnd + 4, next);
    if (content.slice(-2).toString("latin1") === "\r\n") content = content.slice(0, -2);

    const nameMatch = /name="([^"]*)"/i.exec(rawHeaders);
    const fileMatch = /filename="([^"]*)"/i.exec(rawHeaders);
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(rawHeaders);

    if (nameMatch) {
      const name = nameMatch[1];
      if (fileMatch && fileMatch[1]) {
        files.push({
          field: name,
          filename: fileMatch[1],
          contentType: typeMatch ? typeMatch[1].trim() : "",
          data: content
        });
      } else if (!fileMatch) {
        fields[name] = content.toString("utf8");
      }
    }

    position = next;
  }

  return { fields, files };
}

async function parseBody(req) {
  const contentType = req.headers["content-type"] || "";
  const buffer = await readBody(req);

  if (contentType.includes("multipart/form-data")) {
    return parseMultipart(buffer, contentType);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(buffer.toString("utf8"));
    const fields = {};
    for (const [key, value] of params) fields[key] = value;
    return { fields, files: [] };
  }

  return { fields: {}, files: [] };
}

function detectImageExt(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (buffer.slice(0, 4).toString("latin1") === "RIFF" && buffer.slice(8, 12).toString("latin1") === "WEBP") {
    return "webp";
  }
  if (buffer.slice(4, 12).toString("latin1").includes("ftypavif")) return "avif";
  return null;
}

function saveUpload(file) {
  if (!file || !file.filename || !file.data || !file.data.length) return null;
  if (file.data.length > MAX_IMAGE) {
    throw new Error("حجم الصورة أكبر من 5 ميجابايت.");
  }
  const ext = detectImageExt(file.data);
  if (!ext) {
    throw new Error("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP أو AVIF.");
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.data);
  return `assets/images/uploads/${name}`;
}

function slugIsValid(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseKeywords(value) {
  return String(value || "")
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePrice(value) {
  const text = String(value ?? "").trim();
  if (!text) return { value: null, error: null };
  const numeric = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { value: null, error: "السعر يجب أن يكون رقمًا صحيحًا أكبر من أو يساوي صفر." };
  }
  return { value: numeric, error: null };
}

function cleanImagePath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:)?\/\//i.test(text) || text.startsWith("/") || text.startsWith("data:")) return text;
  return text.replace(/^\.?\//, "");
}

function getFile(files, name) {
  return files.find((file) => file.field === name) || null;
}

function csrfOk(session, fields) {
  return Boolean(session && fields && fields._csrf === session.csrf);
}

function flashFromQuery(url) {
  return messageFromQuery(url.searchParams);
}

function adminHtml(res, html, status = 200) {
  send(res, status, html);
}

function authRedirect(res, session) {
  return redirect(res, session ? "/admin" : "/admin/login");
}

/* -------------------------------------------------------------------- static */

function serveStatic(req, res, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    notFound(res);
    return;
  }

  if (relative === "/") relative = "/index.html";

  const clean = relative.replace(/^\/+/, "").replace(/\/+$/, "");
  const segments = clean.split("/");

  if (segments.some((segment) => !segment || segment.startsWith("."))) {
    notFound(res);
    return;
  }
  const blocked = new Set(["admin", "tools", "node_modules"]);
  if (blocked.has(segments[0])) {
    notFound(res);
    return;
  }

  let full = path.resolve(ROOT, clean);
  if (!full.startsWith(ROOT + path.sep)) {
    notFound(res);
    return;
  }

  let stat;
  try {
    stat = fs.statSync(full);
  } catch {
    notFound(res);
    return;
  }

  if (stat.isDirectory()) {
    full = path.join(full, "index.html");
    try {
      stat = fs.statSync(full);
    } catch {
      notFound(res);
      return;
    }
  }

  if (!stat.isFile()) {
    notFound(res);
    return;
  }

  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = fs.createReadStream(full);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  stream.pipe(res);
}

/* ---------------------------------------------------------------------- auth */

function clientKey(req) {
  return req.socket.remoteAddress || "local";
}

function loginBlocked(key) {
  const entry = loginAttempts.get(key);
  if (!entry) return null;
  if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
    const seconds = Math.ceil((entry.blockedUntil - Date.now()) / 1000);
    return `محاولات كثيرة خاطئة. حاول مرة أخرى بعد ${seconds} ثانية.`;
  }
  if (entry.blockedUntil && entry.blockedUntil <= Date.now()) {
    loginAttempts.delete(key);
  }
  return null;
}

function registerFailure(key) {
  const entry = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.blockedUntil = Date.now() + 5 * 60 * 1000;
    entry.count = 0;
  }
  loginAttempts.set(key, entry);
}

function clearFailures(key) {
  loginAttempts.delete(key);
}

async function handleAuth(req, res, url, pathname) {
  if (pathname === "/admin/setup") {
    if (isConfigured()) return redirect(res, "/admin/login");
    if (req.method === "GET") {
      return adminHtml(res, setupPage({ error: null }));
    }
    if (req.method !== "POST") return notFound(res);
    const { fields } = await parseBody(req);
    const password = String(fields.password || "");
    const confirm = String(fields.confirm || "");
    if (password.length < 8) {
      return adminHtml(res, setupPage({ error: "كلمة المرور يجب ألا تقل عن 8 أحرف." }), 400);
    }
    if (password !== confirm) {
      return adminHtml(res, setupPage({ error: "كلمتا المرور غير متطابقتين." }), 400);
    }
    setPassword(password);
    const { token } = createSession();
    return redirect(res, "/admin", { "Set-Cookie": sessionCookie(token) });
  }

  if (pathname === "/admin/login") {
    if (!isConfigured()) return redirect(res, "/admin/setup");
    if (req.method === "GET") {
      return adminHtml(res, loginPage({ error: null }));
    }
    if (req.method !== "POST") return notFound(res);
    const key = clientKey(req);
    const blocked = loginBlocked(key);
    if (blocked) return adminHtml(res, loginPage({ error: blocked }), 429);

    const { fields } = await parseBody(req);
    if (!verifyPassword(String(fields.password || ""))) {
      registerFailure(key);
      return adminHtml(res, loginPage({ error: "كلمة المرور غير صحيحة." }), 401);
    }
    clearFailures(key);
    const { token } = createSession();
    return redirect(res, "/admin", { "Set-Cookie": sessionCookie(token) });
  }

  if (pathname === "/admin/logout" && req.method === "POST") {
    const session = getSession(req);
    if (session) {
      const { fields } = await parseBody(req);
      if (!csrfOk(session, fields)) {
        return adminHtml(res, errorPage({ status: 403, message: "طلب غير صالح." }), 403);
      }
      destroySession(req);
    }
    return redirect(res, "/admin/login", { "Set-Cookie": clearCookie() });
  }

  return notFound(res);
}

/* ----------------------------------------------------------------------- app */

function buildProduct(fields, store, existing, imagePath) {
  const errors = [];
  const name = String(fields.name || "").trim();
  const slug = String(fields.slug || "").trim().toLowerCase();
  const categoryId = String(fields.categoryId || "").trim();
  const price = parsePrice(fields.price);

  if (!name) errors.push("اسم المنتج مطلوب.");
  if (!slug) errors.push("الرابط (slug) مطلوب.");
  else if (!slugIsValid(slug)) errors.push("الرابط يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطات فقط.");
  else if (store.products.some((item) => item.slug === slug && item.id !== existing?.id)) {
    errors.push("الرابط مستخدم في منتج آخر.");
  }
  if (!store.categories.some((category) => category.id === categoryId)) {
    errors.push("الفئة المحددة غير موجودة.");
  }
  if (price.error) errors.push(price.error);

  const availability = ["quote", "in_stock", "out_of_stock"].includes(fields.availability)
    ? fields.availability
    : "quote";

  const product = {
    id:
      existing?.id ||
      (() => {
        let base = `wp-${slug || "product"}`;
        let id = base;
        let index = 2;
        while (store.products.some((item) => item.id === id)) {
          id = `${base}-${index}`;
          index += 1;
        }
        return id;
      })(),
    slug,
    categoryId,
    name,
    shortName: String(fields.shortName || "").trim() || name,
    description: String(fields.description || "").trim(),
    image: imagePath,
    imageAlt: String(fields.imageAlt || "").trim() || name,
    specs: parseLines(fields.specs),
    price: price.value,
    priceCurrency: String(fields.priceCurrency || "EGP").trim() || "EGP",
    availability,
    featured: fields.featured === "1",
    demo: existing ? Boolean(existing.demo) : false,
    keywords: parseKeywords(fields.keywords)
  };

  return { product, errors };
}

function buildPackage(fields, store, existing, imagePath) {
  const errors = [];
  const name = String(fields.name || "").trim();
  const slug = String(fields.slug || "").trim().toLowerCase();
  const price = parsePrice(fields.price);

  if (!name) errors.push("اسم الباقة مطلوب.");
  if (!slug) errors.push("الرابط (slug) مطلوب.");
  else if (!slugIsValid(slug)) errors.push("الرابط يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطات فقط.");
  else if (store.packages.some((item) => item.slug === slug && item.id !== existing?.id)) {
    errors.push("الرابط مستخدم في باقة أخرى.");
  }
  if (price.error) errors.push(price.error);

  const pack = {
    id:
      existing?.id ||
      (() => {
        let base = `wp-package-${slug || "package"}`;
        let id = base;
        let index = 2;
        while (store.packages.some((item) => item.id === id)) {
          id = `${base}-${index}`;
          index += 1;
        }
        return id;
      })(),
    slug,
    name,
    audience: String(fields.audience || "").trim(),
    image: imagePath,
    imageAlt: String(fields.imageAlt || "").trim() || name,
    description: String(fields.description || "").trim(),
    includes: parseLines(fields.includes),
    note: String(fields.note || "").trim(),
    price: price.value,
    priceCurrency: String(fields.priceCurrency || "EGP").trim() || "EGP",
    availability: ["quote", "in_stock", "out_of_stock"].includes(fields.availability)
      ? fields.availability
      : "quote",
    featured: fields.featured === "1",
    demo: existing ? Boolean(existing.demo) : false
  };

  return { pack, errors };
}

function buildCategory(fields, store, existing, imagePath) {
  const errors = [];
  const name = String(fields.name || "").trim();
  const slug = String(fields.slug || "").trim().toLowerCase();

  if (!name) errors.push("اسم الفئة مطلوب.");
  if (!slug) errors.push("الرابط (slug) مطلوب.");
  else if (!slugIsValid(slug)) errors.push("الرابط يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطات فقط.");
  else if (store.categories.some((item) => item.slug === slug && item.id !== existing.id)) {
    errors.push("الرابط مستخدم في فئة أخرى.");
  }

  const category = {
    ...existing,
    name,
    plural: String(fields.plural || "").trim() || name,
    slug,
    image: imagePath,
    description: String(fields.description || "").trim(),
    keywords: parseKeywords(fields.keywords),
    seo: {
      ...(existing.seo || {}),
      title: String(fields.seoTitle || "").trim(),
      metaDescription: String(fields.seoDescription || "").trim(),
      h1: String(fields.seoH1 || "").trim(),
      intro: String(fields.seoIntro || "").trim()
    }
  };

  return { category, errors };
}

async function handleAdmin(req, res, url, pathname) {
  if (
    pathname === "/admin/login" ||
    pathname === "/admin/setup" ||
    pathname === "/admin/logout"
  ) {
    return handleAuth(req, res, url, pathname);
  }

  if (pathname === "/admin/admin.css") {
    return serveAdminAsset(res, "admin.css");
  }

  if (pathname === "/admin" || pathname === "/admin/") {
    const session = getSession(req);
    if (!session) return redirect(res, "/admin/login");
    const store = getStore();
    return adminHtml(
      res,
      dashboardPage({
        store,
        stats: counts(store),
        pending: hasPendingChanges(store),
        csrf: session.csrf,
        flash: flashFromQuery(url)
      })
    );
  }

  const session = getSession(req);
  if (!session) return redirect(res, "/admin/login");
  const store = getStore();

  const method = req.method || "GET";

  /* ---------- products ---------- */
  if (pathname === "/admin/products" && method === "GET") {
    return adminHtml(
      res,
      productsPage({
        store,
        q: url.searchParams.get("q") || "",
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: flashFromQuery(url)
      })
    );
  }

  if (pathname === "/admin/products/new" && method === "GET") {
    return adminHtml(
      res,
      productFormPage({
        store,
        product: null,
        isNew: true,
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: null
      })
    );
  }

  let match = pathname.match(/^\/admin\/products\/([^/]+)\/edit$/);
  if (match && method === "GET") {
    const product = store.products.find((item) => item.id === match[1]);
    if (!product) return notFound(res);
    return adminHtml(
      res,
      productFormPage({
        store,
        product,
        isNew: false,
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: null
      })
    );
  }

  if (pathname === "/admin/products/save" && method === "POST") {
    const { fields, files } = await parseBody(req);
    if (!csrfOk(session, fields)) {
      return adminHtml(res, errorPage({ status: 403, message: "انتهت صلاحية الجلسة. أعد تحميل الصفحة." }), 403);
    }
    const existing = fields.id ? store.products.find((item) => item.id === fields.id) : null;
    if (fields.id && !existing) return notFound(res);

    let imagePath = cleanImagePath(fields.image || existing?.image || "");
    let uploadError = null;
    try {
      const uploaded = saveUpload(getFile(files, "imageFile"));
      if (uploaded) imagePath = uploaded;
    } catch (error) {
      uploadError = error.message;
    }

    const { product, errors } = buildProduct(fields, store, existing, imagePath);
    if (uploadError) errors.push(uploadError);

    if (errors.length) {
      return adminHtml(
        res,
        productFormPage({
          store,
          product,
          isNew: !existing,
          errors,
          csrf: session.csrf,
          pending: hasPendingChanges(store),
          flash: null
        }),
        400
      );
    }

    if (existing) {
      const index = store.products.findIndex((item) => item.id === existing.id);
      store.products[index] = product;
    } else {
      store.products.push(product);
    }
    saveStore(store);
    return redirect(res, "/admin/products?msg=saved");
  }

  match = pathname.match(/^\/admin\/products\/([^/]+)\/delete$/);
  if (match && method === "POST") {
    const { fields } = await parseBody(req);
    if (!csrfOk(session, fields)) {
      return adminHtml(res, errorPage({ status: 403, message: "انتهت صلاحية الجلسة." }), 403);
    }
    const index = store.products.findIndex((item) => item.id === match[1]);
    if (index === -1) return notFound(res);
    store.products.splice(index, 1);
    saveStore(store);
    return redirect(res, "/admin/products?msg=deleted");
  }

  /* ---------- packages ---------- */
  if (pathname === "/admin/packages" && method === "GET") {
    return adminHtml(
      res,
      packagesPage({
        store,
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: flashFromQuery(url)
      })
    );
  }

  if (pathname === "/admin/packages/new" && method === "GET") {
    return adminHtml(
      res,
      packageFormPage({
        store,
        pack: null,
        isNew: true,
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: null
      })
    );
  }

  match = pathname.match(/^\/admin\/packages\/([^/]+)\/edit$/);
  if (match && method === "GET") {
    const pack = store.packages.find((item) => item.id === match[1]);
    if (!pack) return notFound(res);
    return adminHtml(
      res,
      packageFormPage({
        store,
        pack,
        isNew: false,
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: null
      })
    );
  }

  if (pathname === "/admin/packages/save" && method === "POST") {
    const { fields, files } = await parseBody(req);
    if (!csrfOk(session, fields)) {
      return adminHtml(res, errorPage({ status: 403, message: "انتهت صلاحية الجلسة." }), 403);
    }
    const existing = fields.id ? store.packages.find((item) => item.id === fields.id) : null;
    if (fields.id && !existing) return notFound(res);

    let imagePath = cleanImagePath(fields.image || existing?.image || "");
    let uploadError = null;
    try {
      const uploaded = saveUpload(getFile(files, "imageFile"));
      if (uploaded) imagePath = uploaded;
    } catch (error) {
      uploadError = error.message;
    }

    const { pack, errors } = buildPackage(fields, store, existing, imagePath);
    if (uploadError) errors.push(uploadError);

    if (errors.length) {
      return adminHtml(
        res,
        packageFormPage({
          store,
          pack,
          isNew: !existing,
          errors,
          csrf: session.csrf,
          pending: hasPendingChanges(store),
          flash: null
        }),
        400
      );
    }

    if (existing) {
      const index = store.packages.findIndex((item) => item.id === existing.id);
      store.packages[index] = pack;
    } else {
      store.packages.push(pack);
    }
    saveStore(store);
    return redirect(res, "/admin/packages?msg=saved");
  }

  match = pathname.match(/^\/admin\/packages\/([^/]+)\/delete$/);
  if (match && method === "POST") {
    const { fields } = await parseBody(req);
    if (!csrfOk(session, fields)) {
      return adminHtml(res, errorPage({ status: 403, message: "انتهت صلاحية الجلسة." }), 403);
    }
    const index = store.packages.findIndex((item) => item.id === match[1]);
    if (index === -1) return notFound(res);
    store.packages.splice(index, 1);
    saveStore(store);
    return redirect(res, "/admin/packages?msg=deleted");
  }

  /* ---------- categories ---------- */
  if (pathname === "/admin/categories" && method === "GET") {
    return adminHtml(
      res,
      categoriesPage({
        store,
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: flashFromQuery(url)
      })
    );
  }

  match = pathname.match(/^\/admin\/categories\/([^/]+)\/edit$/);
  if (match && method === "GET") {
    const category = store.categories.find((item) => item.id === match[1]);
    if (!category) return notFound(res);
    return adminHtml(
      res,
      categoryFormPage({
        store,
        category,
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: null
      })
    );
  }

  if (pathname === "/admin/categories/save" && method === "POST") {
    const { fields, files } = await parseBody(req);
    if (!csrfOk(session, fields)) {
      return adminHtml(res, errorPage({ status: 403, message: "انتهت صلاحية الجلسة." }), 403);
    }
    const existing = store.categories.find((item) => item.id === fields.id);
    if (!existing) return notFound(res);

    let imagePath = cleanImagePath(fields.image || existing.image || "");
    let uploadError = null;
    try {
      const uploaded = saveUpload(getFile(files, "imageFile"));
      if (uploaded) imagePath = uploaded;
    } catch (error) {
      uploadError = error.message;
    }

    const { category, errors } = buildCategory(fields, store, existing, imagePath);
    if (uploadError) errors.push(uploadError);

    if (errors.length) {
      return adminHtml(
        res,
        categoryFormPage({
          store,
          category,
          errors,
          csrf: session.csrf,
          pending: hasPendingChanges(store),
          flash: null
        }),
        400
      );
    }

    const index = store.categories.findIndex((item) => item.id === existing.id);
    store.categories[index] = category;
    saveStore(store);
    return redirect(res, "/admin/categories?msg=saved");
  }

  /* ---------- settings ---------- */
  if (pathname === "/admin/settings" && method === "GET") {
    return adminHtml(
      res,
      settingsPage({
        store,
        csrf: session.csrf,
        pending: hasPendingChanges(store),
        flash: flashFromQuery(url)
      })
    );
  }

  if (pathname === "/admin/settings" && method === "POST") {
    const { fields } = await parseBody(req);
    if (!csrfOk(session, fields)) {
      return adminHtml(res, errorPage({ status: 403, message: "انتهت صلاحية الجلسة." }), 403);
    }

    const settings = {
      siteUrl: String(fields.siteUrl || "").trim().replace(/\/+$/, ""),
      whatsappNumber: String(fields.whatsappNumber || "").replace(/[^\d]/g, ""),
      phone: String(fields.phone || "").trim(),
      phoneDisplay: String(fields.phoneDisplay || "").trim(),
      email: String(fields.email || "").trim(),
      address: String(fields.address || "").trim(),
      serviceArea: String(fields.serviceArea || "").trim(),
      workingHours: String(fields.workingHours || "").trim(),
      measurementId: String(fields.measurementId || "").trim()
    };

    const errors = [];
    if (settings.siteUrl && !/^https?:\/\/[^\s]+$/i.test(settings.siteUrl)) {
      errors.push("رابط الموقع يجب أن يبدأ بـ http:// أو https://");
    }
    if (settings.whatsappNumber && !/^\d{8,15}$/.test(settings.whatsappNumber)) {
      errors.push("رقم واتساب يجب أن يكون بين 8 و15 رقمًا بالصيغة الدولية بدون +.");
    }
    if (settings.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(settings.email)) {
      errors.push("البريد الإلكتروني غير صحيح.");
    }
    if (settings.measurementId && !/^G-[A-Z0-9]+$/i.test(settings.measurementId)) {
      errors.push("معرّف Google Analytics يجب أن يكون بالشكل G-XXXXXXXXXX.");
    }

    if (errors.length) {
      const draft = { ...store, settings };
      return adminHtml(
        res,
        settingsPage({
          store: draft,
          csrf: session.csrf,
          pending: hasPendingChanges(store),
          flash: { type: "error", text: errors.join(" ") }
        }),
        400
      );
    }

    store.settings = settings;
    saveStore(store);
    return redirect(res, "/admin/settings?msg=settings");
  }

  if (pathname === "/admin/password" && method === "POST") {
    const { fields } = await parseBody(req);
    if (!csrfOk(session, fields)) {
      return adminHtml(res, errorPage({ status: 403, message: "انتهت صلاحية الجلسة." }), 403);
    }
    const current = String(fields.current || "");
    const next = String(fields.next || "");
    if (!verifyPassword(current)) {
      return adminHtml(
        res,
        settingsPage({
          store,
          csrf: session.csrf,
          pending: hasPendingChanges(store),
          flash: { type: "error", text: "كلمة المرور الحالية غير صحيحة." }
        }),
        400
      );
    }
    if (next.length < 8) {
      return adminHtml(
        res,
        settingsPage({
          store,
          csrf: session.csrf,
          pending: hasPendingChanges(store),
          flash: { type: "error", text: "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف." }
        }),
        400
      );
    }
    setPassword(next);
    return redirect(res, "/admin/settings?msg=password");
  }

  /* ---------- publish ---------- */
  if (pathname === "/admin/publish" && method === "POST") {
    const { fields } = await parseBody(req);
    if (!csrfOk(session, fields)) {
      return adminHtml(res, errorPage({ status: 403, message: "انتهت صلاحية الجلسة." }), 403);
    }
    const result = publish(store);
    return adminHtml(
      res,
      publishResultPage({ store: getStore(), result, csrf: session.csrf }),
      result.ok ? 200 : 500
    );
  }

  return notFound(res);
}

function serveAdminAsset(res, name) {
  const full = path.join(PUBLIC_DIR, name);
  try {
    const content = fs.readFileSync(full);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(full)] || "application/octet-stream",
      "Content-Length": content.length,
      "Cache-Control": "no-cache"
    });
    res.end(content);
  } catch {
    notFound(res);
  }
}

/* -------------------------------------------------------------------- server */

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  } catch {
    return notFound(res);
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return notFound(res);
  }

  try {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return await handleAdmin(req, res, url, pathname);
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return notFound(res);
    }
    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error("[admin] request error:", error);
    if (pathname.startsWith("/admin")) {
      return adminHtml(
        res,
        errorPage({ status: 500, message: "حدث خطأ غير متوقع. راجع نافذة السيرفر." }),
        500
      );
    }
    return notFound(res);
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\n[ERROR] Port ${PORT} is already in use.`);
    console.error(`Open http://127.0.0.1:${PORT}/admin (a server may already be running)`);
    console.error(`or start with another port: node admin/server.mjs --port=8124\n`);
  } else {
    console.error("[ERROR]", error.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  try {
    getStore();
  } catch (error) {
    console.error("[admin] Failed to load data:", error.message);
  }
  console.log("");
  console.log("  Watch Point — Local Server");
  console.log("  ---------------------------------------------");
  console.log(`  Site  : http://${HOST}:${PORT}/`);
  console.log(`  Admin : http://${HOST}:${PORT}/admin`);
  console.log("  Stop  : CTRL+C");
  console.log("");
});
