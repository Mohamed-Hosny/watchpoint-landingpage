/* ==========================================================================
   Watch Point — Main UI
   Vanilla JavaScript · No external dependencies
   ========================================================================== */

(function () {
  "use strict";

  const cfg = window.WP_CONFIG || {};
  const doc = document;

  const $ = (selector, context = doc) => context.querySelector(selector);
  const $$ = (selector, context = doc) => Array.from(context.querySelectorAll(selector));

  const state = {
    catalog: { categories: [], products: [], packages: [], brands: [], banners: [] },
    activeCategory: "all",
    activeSubcategory: "",
    query: "",
    searchTimer: null,
    toastTimer: null,
    gaLoaded: false,
    selectedItem: null,
    consent: null,
    wishlist: [],
    compareList: [],
    shelfLimits: {}
  };

  const reducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const whatsappNumber = normaliseWhatsappNumber(
    (cfg.contact && cfg.contact.whatsappNumber) || ""
  );

  /* ------------------------------- Utilities ------------------------------ */

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normaliseWhatsappNumber(value) {
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    let output = "";

    String(value || "")
      .split("")
      .forEach((char) => {
        const arabicIndex = arabicDigits.indexOf(char);
        const persianIndex = persianDigits.indexOf(char);
        if (arabicIndex > -1) output += arabicIndex;
        else if (persianIndex > -1) output += persianIndex;
        else output += char;
      });

    let digits = output.replace(/[^\d]/g, "");
    if (!digits) return "";

    // Strip international exit prefix (e.g. 002010... -> 2010...)
    digits = digits.replace(/^00+/, "");

    // Fix accidental extra zero after Egypt country code (20010... -> 2010...)
    if (/^2001[0125]\d{8}$/.test(digits)) {
      digits = "20" + digits.slice(3);
    }

    // Auto-add Egypt country code for local Egyptian mobile numbers
    if (/^01[0125]\d{8}$/.test(digits)) {
      digits = "2" + digits;
    } else if (/^1[0125]\d{8}$/.test(digits)) {
      digits = "20" + digits;
    }

    // Remove any remaining accidental leading zeros
    return digits.replace(/^0+/, "");
  }

  function normaliseSearch(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalisePhone(value) {
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    let output = "";

    String(value || "")
      .split("")
      .forEach((char) => {
        const arabicIndex = arabicDigits.indexOf(char);
        const persianIndex = persianDigits.indexOf(char);
        if (arabicIndex > -1) output += arabicIndex;
        else if (persianIndex > -1) output += persianIndex;
        else output += char;
      });

    const hasPlus = output.trim().startsWith("+");
    output = output.replace(/[^\d]/g, "");
    return hasPlus ? "+" + output : output;
  }

  function buildWhatsAppUrl(message) {
    const encoded = encodeURIComponent(message || "");
    return whatsappNumber
      ? "https://api.whatsapp.com/send?phone=" + whatsappNumber + "&text=" + encoded
      : "https://api.whatsapp.com/send?text=" + encoded;
  }

  function defaultWhatsAppMessage() {
    return (
      (cfg.whatsapp && cfg.whatsapp.defaultMessage) ||
      "مرحبًا Watch Point، أرغب في الاستفسار عن كاميرات المراقبة والأنظمة الأمنية."
    );
  }

  function getCatalogItem(value) {
    if (!value) return null;
    const product = state.catalog.products.find(
      (item) => item.id === value || item.slug === value
    );
    if (product) return { type: "product", item: product, label: product.name };

    const pack = state.catalog.packages.find(
      (item) => item.id === value || item.slug === value
    );
    if (pack) return { type: "package", item: pack, label: pack.name };

    if (value === "consultation") {
      return { type: "consultation", item: null, label: "استشارة عامة" };
    }
    return null;
  }

  function resolveImage(src) {
    if (!src) return "assets/images/brand-mark.webp";
    if (/^(https?:)?\/\//i.test(src) || src.startsWith("/") || src.startsWith("data:")) {
      return src;
    }
    return src;
  }

  function productFallbackImage(product) {
    if (product && product.mainCategoryId) {
      const cat = (state.catalog.categories || []).find((c) => c.id === product.mainCategoryId);
      if (cat && cat.image) return resolveImage(cat.image);
    }
    return "assets/images/brand-mark.webp";
  }

  function sortProductsForDisplay(list) {
    return list.slice().sort((a, b) => {
      const aFeat = a.featured ? 1 : 0;
      const bFeat = b.featured ? 1 : 0;
      if (aFeat !== bFeat) return bFeat - aFeat;
      const aPriced = a.price !== null && a.price !== undefined && a.price !== "" ? 1 : 0;
      const bPriced = b.price !== null && b.price !== undefined && b.price !== "" ? 1 : 0;
      if (aPriced !== bPriced) return bPriced - aPriced;
      return 0;
    });
  }

  function formatPrice(price, currency) {
    if (price === null || price === undefined || price === "") return null;
    const numeric = Number(price);
    if (!Number.isFinite(numeric)) return null;
    try {
      return new Intl.NumberFormat("ar-EG", {
        style: "currency",
        currency: currency || "EGP",
        maximumFractionDigits: 0
      }).format(numeric);
    } catch (error) {
      return numeric.toLocaleString("ar-EG") + " ج.م";
    }
  }

  function renderPriceBox(rawPrice, currency, isPackage) {
    if (rawPrice !== null && rawPrice !== undefined && rawPrice !== "" && Number.isFinite(Number(rawPrice))) {
      const num = Number(rawPrice);
      const formattedNum = num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
      const currLabel = currency === "USD" ? "USD" : "ج.م";
      return `
        <div class="price-clean">
          <span class="price-clean-amount">${escapeHtml(formattedNum)}</span>
          <span class="price-clean-unit">${escapeHtml(currLabel)}</span>
        </div>
      `;
    }

    return `
      <div class="price-clean price-clean--quote">
        <span class="price-clean-quote">${isPackage ? "يُحدد بعد المعاينة" : "اطلب السعر"}</span>
      </div>
    `;
  }

  function trackEvent(name, params) {
    if (!cfg.features || cfg.features.analytics !== false) {
      const payload = Object.assign(
        { page_location: window.location.href, page_title: doc.title },
        params || {}
      );

      if (window.gtag && state.gaLoaded) {
        window.gtag("event", name, payload);
      } else if (cfg.analytics && cfg.analytics.debug) {
        console.info("[Watch Point analytics]", name, payload);
      }
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    const text = $("#toast-message");
    if (!toast || !text) return;

    text.textContent = message;
    toast.hidden = false;

    if (state.toastTimer) window.clearTimeout(state.toastTimer);

    window.requestAnimationFrame(() => toast.classList.add("is-visible"));

    state.toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => {
        toast.hidden = true;
      }, 260);
    }, 4800);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      /* fall through to legacy copy */
    }

    try {
      const area = doc.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      area.style.pointerEvents = "none";
      doc.body.appendChild(area);
      area.select();
      const copied = doc.execCommand("copy");
      doc.body.removeChild(area);
      return copied;
    } catch (error) {
      return false;
    }
  }

  function setYear() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /* --------------------------- Header / navigation ------------------------ */

  function initMobileMenu() {
    const toggle = $("#menu-toggle");
    const menu = $("#mobile-menu");
    if (!toggle || !menu) return;

    function setOpen(open, returnFocus) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute(
        "aria-label",
        open ? "إغلاق قائمة التنقل" : "فتح قائمة التنقل"
      );
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", String(!open));
      doc.body.classList.toggle("menu-open", open);

      if (open) {
        menu.removeAttribute("inert");
      } else {
        menu.setAttribute("inert", "");
        if (returnFocus) toggle.focus();
      }
    }

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      setOpen(open, false);
    });

    $$("a", menu).forEach((link) => {
      link.addEventListener("click", () => setOpen(false, false));
    });

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false, true);
      }
    });

    doc.addEventListener("click", (event) => {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (!menu.contains(event.target) && !toggle.contains(event.target)) {
        setOpen(false, false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1080) setOpen(false, false);
    });
  }

  function initHeaderScroll() {
    const header = $("#site-header");
    if (!header) return;

    const update = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function initScrollProgress() {
    const button = $("#scroll-progress-fab");
    const ring = $("#scroll-progress-value");
    if (!button || !ring) return;

    const circumference = 2 * Math.PI * 16;
    ring.style.strokeDasharray = String(circumference);

    let updatePending = false;
    const update = () => {
      if (updatePending) return;
      updatePending = true;
      window.requestAnimationFrame(() => {
        updatePending = false;
        const scrollableHeight = Math.max(
          doc.documentElement.scrollHeight,
          doc.body.scrollHeight
        ) - window.innerHeight;
        const progress = scrollableHeight > 0
          ? Math.max(0, Math.min(1, window.scrollY / scrollableHeight))
          : 0;
        const percent = Math.round(progress * 100);

        ring.style.strokeDashoffset = String(circumference * (1 - progress));
        button.setAttribute("aria-label", `العودة لأعلى الصفحة — تم تصفح ${percent}%`);
        button.hidden = window.scrollY < 200;
      });
    };

    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function initScrollSpy() {
    const links = $$(".desktop-nav a[data-nav]");
    if (!links.length || !("IntersectionObserver" in window)) return;

    const sections = links
      .map((link) => doc.getElementById(link.dataset.nav))
      .filter(Boolean);

    if (!sections.length) return;

    const setActive = (id) => {
      links.forEach((link) => {
        const active = link.dataset.nav === id;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-32% 0px -58% 0px", threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
  }

  function initReveal() {
    const elements = $$(".reveal");
    if (!elements.length) return;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach((element) => observer.observe(element));
  }

  /* ----------------------------- Catalog render --------------------------- */

  function categoryName(categoryId) {
    for (const category of state.catalog.categories) {
      if (category.id === categoryId) return category.name;
      const subcategory = (category.subcategories || []).find((item) => item.id === categoryId);
      if (subcategory) return subcategory.name;
    }
    return "منتجات";
  }

  function productsForCategory(categoryId) {
    const category = state.catalog.categories.find((item) => item.id === categoryId);
    if (!category) {
      return state.catalog.products.filter((product) => product.categoryId === categoryId);
    }

    const subcategoryIds = new Set((category.subcategories || []).map((item) => item.id));
    return state.catalog.products.filter(
      (product) =>
        product.categoryId === categoryId ||
        product.mainCategoryId === categoryId ||
        subcategoryIds.has(product.categoryId)
    );
  }

  function productBelongsToCategory(product, categoryId) {
    const category = state.catalog.categories.find((item) => item.id === categoryId);
    if (!category) return product.categoryId === categoryId;
    return (
      product.categoryId === categoryId ||
      product.mainCategoryId === categoryId ||
      (category.subcategories || []).some((item) => item.id === product.categoryId)
    );
  }

  function productMatches(product, query, category, subcategory = "") {
    if (subcategory && product.categoryId !== subcategory) return false;
    if (category && category !== "all" && !productBelongsToCategory(product, category)) return false;
    if (!query) return true;

    const parentCategory = state.catalog.categories.find((item) =>
      (item.subcategories || []).some((subcategoryItem) => subcategoryItem.id === product.categoryId)
    );
    const categoryLabel = categoryName(product.categoryId);
    const haystack = normaliseSearch(
      [
        product.name,
        product.shortName,
        product.description,
        categoryLabel,
        parentCategory && parentCategory.name,
        (product.specs || []).join(" "),
        (product.keywords || []).join(" "),
        (parentCategory && parentCategory.keywords ? parentCategory.keywords.join(" ") : ""),
        (() => {
          const cat = state.catalog.categories.find((item) => item.id === product.categoryId);
          return cat && cat.keywords ? cat.keywords.join(" ") : "";
        })()
      ].join(" ")
    );

    return haystack.includes(query);
  }

  function renderFesCats() {
    const grid = $("#fes-cats-grid");
    if (!grid) return;

    const allCount = state.catalog.products.length;
    const items = [
      {
        id: "all",
        name: "جميع الأقسام",
        image: null,
        badge: allCount > 0 ? `${allCount} منتجات` : "الكل"
      },
      ...state.catalog.categories.map((category) => {
        const catProds = productsForCategory(category.id);
        return {
          id: category.id,
          name: category.name,
          image: category.image,
          badge: catProds.length > 0 ? `${catProds.length} منتجات` : "حلول وتوريد"
        };
      })
    ];

    grid.innerHTML = items
      .map((item) => {
        const isActive = state.activeCategory === item.id;
        const iconHtml = item.image
          ? `<img src="${escapeHtml(resolveImage(item.image))}" alt="${escapeHtml(item.name)}" width="48" height="48" loading="eager" decoding="async">`
          : `<svg class="icon cat-icon" aria-hidden="true"><use href="#icon-shield"/></svg>`;

        return `
          <button class="fes-catcard${isActive ? " is-active" : ""}"
            type="button"
            data-category="${escapeHtml(item.id)}"
            role="tab"
            aria-selected="${isActive ? "true" : "false"}"
            aria-label="${escapeHtml(item.name)}">
            <span class="fes-cat-circle">${iconHtml}</span>
            <span class="fes-cat-name">${escapeHtml(item.name)}</span>
            <span class="fes-cat-badge">${escapeHtml(item.badge)}</span>
          </button>`;
      })
      .join("");

    renderStickyCatBar();
  }

  function renderStickyCatBar() {
    const bar = $("#sticky-cat-bar");
    const pillsContainer = $("#sticky-cat-pills");
    if (!bar || !pillsContainer) return;

    const items = [
      { id: "all", name: "جميع الأقسام", image: null },
      ...state.catalog.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        image: cat.image
      }))
    ];

    pillsContainer.innerHTML = items
      .map((item) => {
        const isActive = state.activeCategory === item.id;
        const iconHtml = item.image
          ? `<img src="${escapeHtml(resolveImage(item.image))}" alt="" width="17" height="17" loading="lazy">`
          : `<svg class="icon" aria-hidden="true"><use href="#icon-shield"/></svg>`;
        return `
          <button type="button" class="sticky-cat-pill${isActive ? " is-active" : ""}" data-sticky-cat="${escapeHtml(item.id)}" role="tab" aria-selected="${isActive ? "true" : "false"}">
            ${iconHtml}
            <span>${escapeHtml(item.name)}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderChips() {
    const container = $("#filter-chips");
    if (!container) return;

    const allCount = state.catalog.products.length;
    const chips = [
      { id: "all", name: "كل المنتجات", count: allCount },
      ...state.catalog.categories.map((category) => ({
        id: category.id,
        name: category.name,
        image: category.image,
        count: productsForCategory(category.id).length
      }))
    ];

    container.innerHTML = chips
      .map(
        (chip) => `
          <button class="chip${state.activeCategory === chip.id ? " is-active" : ""}"
            type="button" data-filter="${escapeHtml(chip.id)}"
            aria-pressed="${state.activeCategory === chip.id}">
            ${
              chip.image
                ? `<img class="chip-logo" src="${escapeHtml(
                    resolveImage(chip.image)
                  )}" alt="" width="26" height="26" loading="lazy">`
                : ""
            }
            ${escapeHtml(chip.name)}
            <span class="count">${chip.count}</span>
          </button>`
      )
      .join("");
  }

  function renderFesSubcats() {
    const bar = $("#fes-subcats-bar");
    if (!bar) return;

    const category = state.catalog.categories.find((item) => item.id === state.activeCategory);
    const subcategories = category && Array.isArray(category.subcategories)
      ? category.subcategories
      : [];

    if (!category || !subcategories.length) {
      bar.innerHTML = "";
      bar.hidden = true;
      return;
    }

    bar.hidden = false;
    const options = [
      { id: "", name: "كل منتجات القسم", count: productsForCategory(category.id).length },
      ...subcategories
        .map((subcategory) => ({
          id: subcategory.id,
          name: subcategory.name,
          count: state.catalog.products.filter((product) => product.categoryId === subcategory.id).length
        }))
        .filter((item) => item.count > 0)
    ];

    const catLinkHtml = category.slug
      ? `<a class="subcat-page-link" href="catalog/${escapeHtml(category.slug)}.html">صفحة القسم ←</a>`
      : "";

    bar.innerHTML =
      `<div class="subcat-bar-head"><span class="subcat-label">الأقسام الفرعية في ${escapeHtml(category.name)}:</span>${catLinkHtml}</div>` +
      `<div class="subcat-pills-wrap">` +
      options
        .map((item) => {
          const isActive = state.activeSubcategory === item.id;
          return `
            <button class="subcat-pill${isActive ? " is-active" : ""}" type="button"
              data-subcategory="${escapeHtml(item.id)}" role="tab"
              aria-selected="${isActive ? "true" : "false"}">
              <span>${escapeHtml(item.name)}</span>
              <span class="subcat-count">${item.count}</span>
            </button>`;
        })
        .join("") +
      `</div>`;
  }

  function renderCategoryGrid() {
    const grid = $("#category-grid");
    if (!grid) return;

    const categories = state.catalog.categories || [];
    if (!categories.length) {
      grid.innerHTML = "";
      grid.setAttribute("aria-busy", "false");
      return;
    }

    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = categories
      .map((category) => {
        const url = category.slug ? "catalog/" + category.slug + ".html" : "#products";
        const image = resolveImage(category.image);
        return `
          <a class="category-card" href="${escapeHtml(url)}" data-category="${escapeHtml(category.id)}">
            <span class="category-card-media">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(category.name)}" width="120" height="120" loading="eager" decoding="async">
            </span>
            <span class="category-card-name">${escapeHtml(category.name)}</span>
          </a>`;
      })
      .join("");
  }

  function productShortDesc(product) {
    if (!product) return "";
    const shortText = String(product.shortName || "").trim();
    if (shortText && shortText !== product.name) return shortText;
    const descText = String(product.description || "").trim();
    if (descText) return descText;
    if (Array.isArray(product.specs) && product.specs.length) return product.specs[0];
    return categoryName(product.categoryId);
  }

  function renderProductCard(product) {
    const category = categoryName(product.categoryId);
    const waMessage = [
      (cfg.whatsapp && cfg.whatsapp.productIntro) ||
        "مرحبًا Watch Point، أرغب في طلب عرض سعر لهذا المنتج:",
      "",
      "المنتج: " + product.name,
      "الفئة: " + category,
      "",
      "أرسلت من موقع Watch Point."
    ].join("\n");
    const waUrl = buildWhatsAppUrl(waMessage);
    const cleanSlug = String(product.slug || product.id || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const detailsUrl = cleanSlug ? "catalog/product-" + cleanSlug + ".html" : "product.html?id=" + encodeURIComponent(product.id);
    const isWishlisted = state.wishlist.includes(product.id);
    const isCompared = state.compareList.includes(product.id);
    const shortSubtitle = productShortDesc(product);

    return `
      <article class="product-card product-card--luxury" data-product-id="${escapeHtml(product.id)}" data-url="${escapeHtml(detailsUrl)}">
        <div class="product-media-wrap">
          <div class="product-card-tools" aria-label="أدوات المنتج">
            <button type="button"
              class="card-tool-btn ${isWishlisted ? "is-active" : ""}"
              data-card-tool="wishlist"
              data-product-id="${escapeHtml(product.id)}"
              data-tooltip="${isWishlisted ? "إزالة من المفضلة" : "أضف للمفضلة"}"
              aria-label="${isWishlisted ? "إزالة من المفضلة" : "أضف للمفضلة"}"
              aria-pressed="${isWishlisted ? "true" : "false"}">
              <svg class="icon" aria-hidden="true"><use href="#icon-heart-fill"/></svg>
            </button>
            <button type="button"
              class="card-tool-btn ${isCompared ? "is-active" : ""}"
              data-card-tool="compare"
              data-product-id="${escapeHtml(product.id)}"
              data-tooltip="${isCompared ? "مضاف للمقارنة" : "قارن المنتج"}"
              aria-label="قارن هذا المنتج"
              aria-pressed="${isCompared ? "true" : "false"}">
              <svg class="icon" aria-hidden="true"><use href="#icon-compare"/></svg>
            </button>
            <button type="button"
              class="card-tool-btn"
              data-card-tool="similar"
              data-product-id="${escapeHtml(product.id)}"
              data-tooltip="منتجات مشابهة"
              aria-label="عرض منتجات مشابهة">
              <svg class="icon" aria-hidden="true"><use href="#icon-similar"/></svg>
            </button>
          </div>
          <a class="product-media" href="${escapeHtml(detailsUrl)}" aria-label="عرض تفاصيل ${escapeHtml(product.name)}">
            <img src="${escapeHtml(resolveImage(product.image))}"
              alt="${escapeHtml(product.imageAlt || product.name)}"
              width="600" height="450" loading="lazy" decoding="async"
              onerror="this.onerror=null;this.src='${escapeHtml(productFallbackImage(product))}'">
          </a>
        </div>
        <div class="product-body">
          <h3 class="product-title">
            <a href="${escapeHtml(detailsUrl)}">${escapeHtml(product.name)}</a>
          </h3>
          <p class="product-desc">${escapeHtml(shortSubtitle)}</p>
          <div class="product-foot">
            <div class="price-row">
              ${renderPriceBox(product.price, product.priceCurrency, false)}
            </div>
            <div class="product-actions">
              <a class="btn btn--primary btn--card"
                href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer"
                data-wa-message="${escapeHtml(waMessage)}"
                data-wa-placement="product_card" data-wa-item="${escapeHtml(product.name)}"
                data-analytics="product_quote"
                aria-label="اطلب عرض سعر ${escapeHtml(product.name)}">
                <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
                <span>اطلب عرض سعر</span>
              </a>
            </div>
          </div>
        </div>
      </article>`;
  }

  function renderProducts() {
    const grid = $("#product-grid");
    const noResults = $("#no-results");
    const countEl = $("#results-count");
    if (!grid) return;

    grid.setAttribute("aria-busy", "false");

    // Case 1: Active search query
    if (state.query) {
      const filtered = sortProductsForDisplay(
        state.catalog.products.filter((product) =>
          productMatches(product, state.query, state.activeCategory, state.activeSubcategory)
        )
      );

      if (!filtered.length) {
        grid.innerHTML = "";
        grid.hidden = true;
        if (noResults) noResults.hidden = false;
        if (countEl) countEl.textContent = "لا توجد نتائج مطابقة لـ «" + state.query + "»";
        trackEvent("search_no_results", { search_term: state.query });
        return;
      }

      grid.hidden = false;
      if (noResults) noResults.hidden = true;
      if (countEl) countEl.textContent = filtered.length + " نتيجة بحث لـ «" + state.query + "»";

      const searchShelfKey = "__search__";
      const searchLimit = state.shelfLimits[searchShelfKey] || 36;
      const visibleSearch = filtered.slice(0, searchLimit);
      const remainingSearch = Math.max(0, filtered.length - visibleSearch.length);

      grid.innerHTML = `
        <div class="category-shelf">
          <div class="category-shelf-head">
            <div class="shelf-pill-wrap">
              <span class="shelf-circle-mini">
                <svg class="icon" aria-hidden="true"><use href="#icon-search"/></svg>
              </span>
              <div class="shelf-title-wrap">
                <h3 class="shelf-title">
                  نتائج البحث عن «${escapeHtml(state.query)}»
                  <span class="shelf-count">${filtered.length} نتيجة</span>
                </h3>
              </div>
            </div>
          </div>
          <div class="product-grid">
            ${visibleSearch.map(renderProductCard).join("")}
          </div>
          ${
            remainingSearch > 0
              ? `<div class="shelf-load-more-bar">
                   <button type="button" class="btn btn--soft shelf-load-more-btn" data-load-more="${searchShelfKey}" data-load-step="36">
                     <span>عرض المزيد من نتائج البحث (${remainingSearch} متبقي)</span>
                   </button>
                 </div>`
              : ""
          }
        </div>`;
      return;
    }

    // Case 2: Specific category selected
    if (state.activeCategory !== "all") {
      const cat = state.catalog.categories.find((c) => c.id === state.activeCategory);
      const catProducts = sortProductsForDisplay(
        state.activeSubcategory
          ? state.catalog.products.filter((product) => product.categoryId === state.activeSubcategory)
          : productsForCategory(state.activeCategory)
      );
      const selectedSubcategory = cat && (cat.subcategories || []).find(
        (item) => item.id === state.activeSubcategory
      );

      grid.hidden = false;
      if (noResults) noResults.hidden = true;
      if (countEl) {
        countEl.textContent = catProducts.length
          ? catProducts.length + " منتج في " + (cat ? cat.name : "")
          : selectedSubcategory
            ? "لا توجد منتجات في فئة " + selectedSubcategory.name
            : "قسم " + (cat ? cat.name : "");
      }

      if (!catProducts.length) {
        const catName = cat ? cat.name : "القسم";
        const catDesc = cat && cat.description ? cat.description : "حلول متكاملة للتوريد والتركيب والبرمجة.";
        const catSlug = cat ? cat.slug : "";
        const imageHtml = cat && cat.image
          ? `<img src="${escapeHtml(resolveImage(cat.image))}" alt="" width="28" height="28">`
          : `<svg class="icon" aria-hidden="true"><use href="#icon-shield"/></svg>`;

        grid.innerHTML = `
          <div class="category-shelf" data-shelf-cat="${escapeHtml(state.activeCategory)}">
            <div class="category-shelf-head">
              <div class="shelf-pill-wrap">
                <span class="shelf-circle-mini">${imageHtml}</span>
                <div class="shelf-title-wrap">
                  <h3 class="shelf-title">${escapeHtml(selectedSubcategory ? selectedSubcategory.name : catName)}</h3>
                  <p class="shelf-desc">${escapeHtml(catDesc)}</p>
                </div>
              </div>
              ${
                catSlug
                  ? `<a class="shelf-link" href="catalog/${escapeHtml(catSlug)}.html">
                      <span>دليل ${escapeHtml(catName)} والمواصفات</span>
                      <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
                    </a>`
                  : ""
              }
            </div>
            <div class="cat-empty-shelf">
              <svg class="icon" style="width:48px;height:48px;color:var(--blue-600);margin-bottom:0.75rem;" aria-hidden="true"><use href="#icon-shield"/></svg>
              <h3>أنظمة وموديلات ${escapeHtml(catName)} متوفرة للتوريد والتركيب</h3>
              <p>نوفر أحدث الأجهزة والموديلات الأصلية المعتمدة لـ ${escapeHtml(catName)} بضمان كامل مع المعاينة الفنية المجانية واختيار أفضل ما يناسب مساحتك وميزانيتك.</p>
              <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
                <a class="btn btn--primary" href="#contact">طلب معاينة وعرض سعر فوري</a>
                ${
                  catSlug
                    ? `<a class="btn btn--soft" href="catalog/${escapeHtml(catSlug)}.html">استعراض دليل الفئة الفني</a>`
                    : ""
                }
              </div>
            </div>
          </div>`;
        return;
      }

      const catName = cat ? cat.name : "";
      const catDesc = cat && cat.description ? cat.description : "";
      const catSlug = cat ? cat.slug : "";
      const imageHtml = cat && cat.image
        ? `<img src="${escapeHtml(resolveImage(cat.image))}" alt="" width="28" height="28">`
        : `<svg class="icon" aria-hidden="true"><use href="#icon-shield"/></svg>`;

      const shelfKey = "cat:" + state.activeCategory + ":" + (state.activeSubcategory || "all");
      const limit = state.shelfLimits[shelfKey] || 24;
      const visibleProducts = catProducts.slice(0, limit);
      const remaining = Math.max(0, catProducts.length - visibleProducts.length);

      grid.innerHTML = `
        <div class="category-shelf" data-shelf-cat="${escapeHtml(state.activeCategory)}">
          <div class="category-shelf-head">
            <div class="shelf-pill-wrap">
              <span class="shelf-circle-mini">${imageHtml}</span>
              <div class="shelf-title-wrap">
                <h3 class="shelf-title">
                  ${escapeHtml(selectedSubcategory ? selectedSubcategory.name : catName)}
                  <span class="shelf-count">${catProducts.length} منتج</span>
                </h3>
                <p class="shelf-desc">${escapeHtml(catDesc)}</p>
              </div>
            </div>
            ${
              catSlug
                ? `<a class="shelf-link" href="catalog/${escapeHtml(catSlug)}.html">
                    <span>دليل ${escapeHtml(catName)} كاملًا</span>
                    <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
                  </a>`
                : ""
            }
          </div>
          <div class="product-grid">
            ${visibleProducts.map(renderProductCard).join("")}
          </div>
          ${
            remaining > 0
              ? `<div class="shelf-load-more-bar">
                   <button type="button" class="btn btn--primary shelf-load-more-btn" data-load-more="${escapeHtml(shelfKey)}" data-load-step="24">
                     <span>عرض المزيد من المنتجات (+${Math.min(24, remaining)} من ${remaining} متبقي)</span>
                   </button>
                   <button type="button" class="btn btn--soft shelf-load-all-btn" data-load-all="${escapeHtml(shelfKey)}" data-load-total="${catProducts.length}">
                     <span>عرض كل منتجات القسم (${catProducts.length})</span>
                   </button>
                 </div>`
              : ""
          }
        </div>`;
      return;
    }

    // Case 3: "All categories" view (Divided into category shelves)
    grid.hidden = false;
    if (noResults) noResults.hidden = true;
    if (countEl) countEl.textContent = `${state.catalog.products.length} منتج معتمد · ${state.catalog.categories.length} أقسام رئيسية`;

    const shelvesHtml = [];
    const populatedCategoryIds = new Set();

    // Render shelves for categories with products
    state.catalog.categories.forEach((cat) => {
      const catProducts = sortProductsForDisplay(productsForCategory(cat.id));
      if (!catProducts.length) return;

      populatedCategoryIds.add(cat.id);
      const imageHtml = cat.image
        ? `<img src="${escapeHtml(resolveImage(cat.image))}" alt="" width="28" height="28">`
        : `<svg class="icon" aria-hidden="true"><use href="#icon-shield"/></svg>`;

      const shelfKey = "all:" + cat.id;
      const limit = state.shelfLimits[shelfKey] || 15;
      const visibleProducts = catProducts.slice(0, limit);
      const remaining = Math.max(0, catProducts.length - visibleProducts.length);

      const subChips = (cat.subcategories || [])
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          count: state.catalog.products.filter((p) => p.categoryId === sub.id).length
        }))
        .filter((sub) => sub.count > 0);
      const subChipsHtml = subChips.length
        ? `<div class="shelf-subcats-row" aria-label="الأقسام الفرعية في ${escapeHtml(cat.name)}">
            ${subChips
              .map(
                (sub) => `<button type="button" class="shelf-subcat-chip" data-jump-subcat="${escapeHtml(cat.id)}:${escapeHtml(sub.id)}">${escapeHtml(sub.name)} <span>${sub.count}</span></button>`
              )
              .join("")}
          </div>`
        : "";

      shelvesHtml.push(`
        <div class="category-shelf" data-shelf-cat="${escapeHtml(cat.id)}">
          <div class="category-shelf-head">
            <div class="shelf-pill-wrap">
              <span class="shelf-circle-mini">${imageHtml}</span>
              <div class="shelf-title-wrap">
                <h3 class="shelf-title">
                  ${escapeHtml(cat.name)}
                  <span class="shelf-count">${catProducts.length} منتج</span>
                </h3>
                <p class="shelf-desc">${escapeHtml(cat.description || "")}</p>
              </div>
            </div>
            ${
              cat.slug
                ? `<a class="shelf-link" href="catalog/${escapeHtml(cat.slug)}.html">
                    <span>دليل ${escapeHtml(cat.name)} كاملًا</span>
                    <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
                  </a>`
                : ""
            }
          </div>
          ${subChipsHtml}
          <div class="product-grid">
            ${visibleProducts.map(renderProductCard).join("")}
          </div>
          ${
            remaining > 0
              ? `<div class="shelf-load-more-bar">
                   <button type="button" class="btn btn--soft shelf-load-more-btn" data-load-more="${escapeHtml(shelfKey)}" data-load-step="15">
                     <span>عرض المزيد في ${escapeHtml(cat.name)} (+${Math.min(15, remaining)} من ${remaining} متبقي)</span>
                   </button>
                   <button type="button" class="btn btn--outline shelf-select-cat-btn" data-select-cat-shelf="${escapeHtml(cat.id)}">
                     <span>تصفح قسم ${escapeHtml(cat.name)} بالكامل (${catProducts.length}) ←</span>
                   </button>
                 </div>`
              : ""
          }
        </div>
      `);
    });

    // Render remaining categories showcase
    const otherCats = state.catalog.categories.filter(
      (cat) => !populatedCategoryIds.has(cat.id)
    );

    if (otherCats.length) {
      const showcaseCardsHtml = otherCats
        .map((cat) => {
          const url = cat.slug ? `catalog/${cat.slug}.html` : "#contact";
          const imageHtml = cat.image
            ? `<img src="${escapeHtml(resolveImage(cat.image))}" alt="" width="30" height="30" loading="lazy">`
            : `<svg class="icon" style="width:24px;height:24px;color:var(--blue-600);" aria-hidden="true"><use href="#icon-shield"/></svg>`;

          return `
            <a class="cat-showcase-card" href="${escapeHtml(url)}" data-category="${escapeHtml(cat.id)}">
              <span class="cat-showcase-icon">${imageHtml}</span>
              <div class="cat-showcase-info">
                <h4>${escapeHtml(cat.name)}</h4>
                <p>${escapeHtml(cat.description || "توريد وتركيب معتمد")}</p>
              </div>
            </a>
          `;
        })
        .join("");

      shelvesHtml.push(`
        <div class="category-showcase-box">
          <h3 class="category-showcase-title">أقسام أمنية إضافية متوفرة للتوريد والتنفيذ</h3>
          <p class="category-showcase-sub">نوفر جميع مكونات وأنظمة المراقبة المتكاملة للمنازل والشركات بضمان معتمد بعد المعاينة المباشرة للموقع:</p>
          <div class="category-showcase-grid">
            ${showcaseCardsHtml}
          </div>
        </div>
      `);
    }

    grid.innerHTML = shelvesHtml.join("");
  }

  function renderPackages() {
    const grid = $("#package-grid");
    if (!grid) return;

    grid.innerHTML = state.catalog.packages
      .map((pack, idx) => {
        const featuredClass = pack.featured ? " package-card--featured" : "";
        const includesList = Array.isArray(pack.includes) ? pack.includes : [];

        // Split bilingual title if separated by – or -
        const rawName = String(pack.name || "").trim();
        let enTitle = "";
        let arTitle = rawName;
        const dashMatch = rawName.match(/^([A-Za-z0-9\s&/+.]+?)\s*[–—-]\s*(.+)$/);
        if (dashMatch) {
          enTitle = dashMatch[1].trim();
          arTitle = dashMatch[2].trim();
        } else {
          const reverseMatch = rawName.match(/^(.+?)\s*[–—-]\s*([A-Za-z0-9\s&/+.]+)$/);
          if (reverseMatch) {
            arTitle = reverseMatch[1].trim();
            enTitle = reverseMatch[2].trim();
          }
        }

        const waMsg = [
          "مرحبًا Watch Point، أرغب في الاستفسار وطلب عرض سعر لـ:",
          "الباقة: " + rawName,
          includesList.length ? "المكونات: " + includesList.slice(0, 4).join(" + ") : ""
        ]
          .filter(Boolean)
          .join("\n");
        const waHref = buildWhatsAppUrl(waMsg);

        return `
          <article class="package-card${featuredClass}" data-package-id="${escapeHtml(pack.id)}">
            <div class="package-media-stage">
              <div class="package-media-top">
                <span class="package-badge${pack.featured ? " package-badge--featured" : ""}">
                  ${pack.featured ? "★ الباقة الأكثر طلباً" : `الباقة 0${idx + 1}`}
                </span>
                ${
                  includesList.length
                    ? `<span class="package-count-pill">${includesList.length} مكونات أساسية</span>`
                    : ""
                }
              </div>
              <div class="package-media">
                <img src="${escapeHtml(resolveImage(pack.image))}"
                  alt="${escapeHtml(pack.imageAlt || pack.name)}"
                  width="800" height="600" loading="lazy" decoding="async">
              </div>
            </div>

            <div class="package-body">
              <div class="package-head-block">
                ${
                  enTitle
                    ? `<span class="package-en-kicker" lang="en">${escapeHtml(enTitle)}</span>`
                    : `<span class="package-en-kicker">حلول متكاملة قابلة للتخصيص</span>`
                }
                <h3 class="package-title">${escapeHtml(arTitle)}</h3>
              </div>

              ${
                pack.audience
                  ? `<div class="package-audience">
                      <svg class="icon" aria-hidden="true"><use href="#icon-shield"/></svg>
                      <span><strong>مناسبة لـ:</strong> ${escapeHtml(pack.audience)}</span>
                    </div>`
                  : ""
              }

              ${pack.description ? `<p class="package-desc">${escapeHtml(pack.description)}</p>` : ""}

              ${
                includesList.length
                  ? `<div class="package-includes-box">
                      <div class="package-includes-head">
                        <span>مشتملات ومكونات الباقة</span>
                        <span class="package-includes-tag">شامل التركيب والبرمجة</span>
                      </div>
                      <ul class="package-includes">
                        ${includesList
                          .map(
                            (item) => `
                              <li>
                                <span class="package-check-icon" aria-hidden="true">
                                  <svg class="icon"><use href="#icon-check"/></svg>
                                </span>
                                <span>${escapeHtml(item)}</span>
                              </li>`
                          )
                          .join("")}
                      </ul>
                    </div>`
                  : ""
              }

              ${
                pack.note
                  ? `<p class="package-note">
                      <svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg>
                      <span>${escapeHtml(pack.note)}</span>
                    </p>`
                  : ""
              }

              <div class="package-foot">
                <div class="package-price-bar">
                  <span class="package-price-label">تكلفة الباقة:</span>
                  <div class="price-row">
                    ${renderPriceBox(pack.price, pack.priceCurrency, true)}
                  </div>
                </div>
                <div class="package-actions-row">
                  <a class="btn btn--primary btn--card package-cta-main"
                    href="#contact" data-select-package="${escapeHtml(pack.id)}"
                    data-analytics="package_quote">
                    <span>اطلب عرض سعر للباقة</span>
                    <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
                  </a>
                  <a class="btn btn--whatsapp package-cta-wa"
                    href="${escapeHtml(waHref)}"
                    target="_blank" rel="noopener noreferrer"
                    data-wa-message="${escapeHtml(waMsg)}"
                    data-wa-item="${escapeHtml(rawName)}"
                    data-wa-placement="package_card"
                    title="استفسر عن الباقة عبر واتساب">
                    <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
                    <span>واتساب</span>
                  </a>
                </div>
              </div>
            </div>
          </article>`;
      })
      .join("");
  }

  function initProductTools() {
    const grid = $("#product-grid");
    if (!grid) return;

    renderFesCats();
    renderFesSubcats();
    renderCategoryGrid();
    renderChips();
    renderProducts();

    // Mobile/Tablet 2-col vs 3-col grid density switcher
    const densityWrap = $("#grid-density-toggle");
    if (densityWrap) {
      const applyCols = (cols) => {
        const use3 = String(cols) === "3";
        grid.classList.toggle("product-grid--cols-3", use3);
        $$(".density-btn", densityWrap).forEach((btn) => {
          const active = btn.dataset.gridCols === (use3 ? "3" : "2");
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", String(active));
        });
        try {
          sessionStorage.setItem("wp_grid_cols", use3 ? "3" : "2");
        } catch {}
      };
      try {
        const saved = sessionStorage.getItem("wp_grid_cols");
        if (saved === "3") applyCols("3");
      } catch {}
      densityWrap.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-grid-cols]");
        if (!btn) return;
        applyCols(btn.dataset.gridCols);
      });
    }

    const fesGrid = $("#fes-cats-grid");
    if (fesGrid) {
      fesGrid.addEventListener("click", (event) => {
        const button = event.target.closest("[data-category]");
        if (!button) return;
        state.activeCategory = button.dataset.category;
        state.activeSubcategory = "";
        renderFesCats();
        renderFesSubcats();
        renderChips();
        renderProducts();
        trackEvent("filter_category", { category: state.activeCategory });
      });
    }

    grid.addEventListener("click", (event) => {
      // Load more products in a shelf
      const loadMoreBtn = event.target.closest("[data-load-more]");
      if (loadMoreBtn) {
        event.preventDefault();
        const shelfKey = loadMoreBtn.dataset.loadMore;
        const step = Number(loadMoreBtn.dataset.loadStep) || 24;
        const defaultStart = shelfKey.startsWith("all:") ? 15 : shelfKey === "__search__" ? 36 : 24;
        state.shelfLimits[shelfKey] = (state.shelfLimits[shelfKey] || defaultStart) + step;
        renderProducts();
        return;
      }

      // Load all products in a category shelf
      const loadAllBtn = event.target.closest("[data-load-all]");
      if (loadAllBtn) {
        event.preventDefault();
        const shelfKey = loadAllBtn.dataset.loadAll;
        const total = Number(loadAllBtn.dataset.loadTotal) || 999;
        state.shelfLimits[shelfKey] = total;
        renderProducts();
        return;
      }

      // Jump straight to a subcategory from shelf quick-chips
      const jumpSubBtn = event.target.closest("[data-jump-subcat]");
      if (jumpSubBtn) {
        event.preventDefault();
        const [catId, subId] = String(jumpSubBtn.dataset.jumpSubcat || "").split(":");
        if (catId) {
          state.activeCategory = catId;
          state.activeSubcategory = subId || "";
          renderFesCats();
          renderFesSubcats();
          renderChips();
          renderProducts();
          const subBar = document.getElementById("fes-subcats-bar") || document.getElementById("store");
          if (subBar) subBar.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }

      // Switch to single category view from "All categories" shelf button
      const selectCatShelfBtn = event.target.closest("[data-select-cat-shelf]");
      if (selectCatShelfBtn) {
        event.preventDefault();
        const catId = selectCatShelfBtn.dataset.selectCatShelf;
        if (catId) {
          state.activeCategory = catId;
          state.activeSubcategory = "";
          renderFesCats();
          renderFesSubcats();
          renderChips();
          renderProducts();
          const storeSec = document.getElementById("store");
          if (storeSec) {
            storeSec.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
        return;
      }

      // If clicking inside a showcase category card
      const showcaseCard = event.target.closest(".cat-showcase-card[data-category]");
      if (showcaseCard) {
        const catId = showcaseCard.dataset.category;
        if (catId) {
          event.preventDefault();
          state.activeCategory = catId;
          state.activeSubcategory = "";
          renderFesCats();
          renderFesSubcats();
          renderChips();
          renderProducts();
          const storeSec = document.getElementById("store");
          if (storeSec) {
            storeSec.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          return;
        }
      }

      // If clicking one of the 3 product card tools (Wishlist, Compare, Similar)
      const toolBtn = event.target.closest("[data-card-tool]");
      if (toolBtn) {
        event.preventDefault();
        event.stopPropagation();
        const action = toolBtn.dataset.cardTool;
        const pid = toolBtn.dataset.productId;
        if (action === "wishlist") toggleWishlist(pid, toolBtn);
        else if (action === "compare") toggleCompare(pid, toolBtn);
        else if (action === "similar") openSimilarDrawer(pid);
        return;
      }

      // If clicking Quick View button inside a product card
      const qvBtn = event.target.closest("[data-quick-view]");
      if (qvBtn) {
        event.preventDefault();
        event.stopPropagation();
        openQuickView(qvBtn.dataset.quickView);
        return;
      }

      const card = event.target.closest(".product-card");
      if (!card) return;

      // Don't navigate if clicking WhatsApp button
      if (event.target.closest(".btn--card")) return;

      // Don't navigate if selecting text
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;

      const url = card.dataset.url;
      const productId = card.dataset.productId;
      if (url) {
        event.preventDefault();
        if (url.startsWith("#") || url.startsWith("product.html")) {
          window.location.href = url;
          return;
        }
        fetch(url, { method: "HEAD", cache: "no-store" })
          .then((res) => {
            if (res && res.ok) {
              window.location.href = url;
            } else if (productId) {
              window.location.href = "product.html?id=" + encodeURIComponent(productId);
            } else {
              window.location.href = url;
            }
          })
          .catch(() => {
            if (productId) {
              window.location.href = "product.html?id=" + encodeURIComponent(productId);
            } else {
              window.location.href = url;
            }
          });
      }
    });

    const subcatsBar = $("#fes-subcats-bar");
    if (subcatsBar) {
      subcatsBar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-subcategory]");
        if (!button) return;
        state.activeSubcategory = button.dataset.subcategory;
        renderFesSubcats();
        renderProducts();
        trackEvent("filter_subcategory", {
          category: state.activeCategory,
          subcategory: state.activeSubcategory || "all"
        });
      });
    }

    const chips = $("#filter-chips");
    if (chips) {
      chips.addEventListener("click", (event) => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;
        state.activeCategory = button.dataset.filter;
        state.activeSubcategory = "";
        renderFesCats();
        renderFesSubcats();
        renderChips();
        renderProducts();
        trackEvent("filter_products", { filter: state.activeCategory });
      });
    }

    const search = $("#product-search");
    const clear = $("#search-clear");

    if (search) {
      search.addEventListener("input", () => {
        state.query = normaliseSearch(search.value);
        if (clear) clear.hidden = !search.value;

        if (state.searchTimer) window.clearTimeout(state.searchTimer);

        state.searchTimer = window.setTimeout(() => {
          renderProducts();
          if (state.query.length >= 2) {
            trackEvent("search", {
              search_term: state.query,
              results: state.catalog.products.filter((product) =>
                productMatches(product, state.query, state.activeCategory, state.activeSubcategory)
              ).length
            });
          }
        }, 160);
      });

      search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          state.query = normaliseSearch(search.value);
          renderProducts();
        }
      });
    }

    if (clear && search) {
      clear.addEventListener("click", () => {
        search.value = "";
        state.query = "";
        clear.hidden = true;
        renderProducts();
        search.focus();
      });
    }

    const reset = $("#reset-search");
    if (reset) {
      reset.addEventListener("click", () => {
        state.query = "";
        state.activeCategory = "all";
        state.activeSubcategory = "";
        if (search) {
          search.value = "";
          if (clear) clear.hidden = true;
        }
        renderFesCats();
        renderFesSubcats();
        renderChips();
        renderProducts();
        if (search) search.focus();
      });
    }
  }

  /* ------------------------------ Quote form ------------------------------ */

  function populateProductSelect() {
    const select = $("#quote-product");
    if (!select) return;

    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML = "";
    if (placeholder) select.appendChild(placeholder);

    if (state.catalog.products.length) {
      const group = doc.createElement("optgroup");
      group.label = "المنتجات";
      state.catalog.products.forEach((product) => {
        const option = doc.createElement("option");
        option.value = product.id;
        option.textContent = product.name;
        group.appendChild(option);
      });
      select.appendChild(group);
    }

    if (state.catalog.packages.length) {
      const group = doc.createElement("optgroup");
      group.label = "الباقات";
      state.catalog.packages.forEach((pack) => {
        const option = doc.createElement("option");
        option.value = pack.id;
        option.textContent = pack.name;
        group.appendChild(option);
      });
      select.appendChild(group);
    }

    const consultation = doc.createElement("option");
    consultation.value = "consultation";
    consultation.textContent = "استشارة عامة / غير محدد";
    select.appendChild(consultation);
  }

  function initQuoteForm() {
    const form = $("#quote-form");
    if (!form) return;

    populateProductSelect();

    const fields = {
      name: {
        input: $("#quote-name"),
        error: $("#quote-name-error"),
        validate: (value) => {
          const clean = value.trim();
          if (clean.length < 2) return "يرجى إدخال الاسم (حرفان على الأقل).";
          if (clean.length > 60) return "الاسم طويل جدًا. استخدم 60 حرفًا أو أقل.";
          return "";
        }
      },
      phone: {
        input: $("#quote-phone"),
        error: $("#quote-phone-error"),
        validate: (value) => {
          const clean = normalisePhone(value);
          if (!/^\+?\d{8,15}$/.test(clean)) {
            return "يرجى إدخال رقم هاتف صحيح (من 8 إلى 15 رقمًا).";
          }
          return "";
        }
      },
      product: {
        input: $("#quote-product"),
        error: $("#quote-product-error"),
        validate: (value) => {
          if (!value) return "يرجى اختيار منتج أو باقة.";
          if (!getCatalogItem(value)) return "يرجى اختيار منتج أو باقة من القائمة.";
          return "";
        }
      }
    };

    function setError(name, message) {
      const field = fields[name];
      if (!field || !field.input) return;
      const wrapper = field.input.closest(".field");
      if (wrapper) wrapper.classList.toggle("has-error", Boolean(message));
      if (field.error) field.error.textContent = message || "";
      field.input.setAttribute("aria-invalid", message ? "true" : "false");
    }

    function validateField(name) {
      const field = fields[name];
      if (!field || !field.input) return true;
      const message = field.validate(field.input.value);
      setError(name, message);
      return !message;
    }

    Object.keys(fields).forEach((name) => {
      const field = fields[name];
      if (!field.input) return;
      const eventName = field.input.tagName === "SELECT" ? "change" : "input";
      field.input.addEventListener(eventName, () => setError(name, ""));
      field.input.addEventListener("blur", () => validateField(name));
    });

    const query = new URLSearchParams(window.location.search);
    const requested = query.get("product") || query.get("package");
    if (requested) {
      const match = getCatalogItem(requested);
      if (match && fields.product.input) {
        fields.product.input.value = match.item ? match.item.id : requested;
        const status = $("#form-status");
        if (status) {
          status.textContent = "تم اختيار «" + match.label + "». أكمل بياناتك لإرسال الطلب.";
        }
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const status = $("#form-status");
      const fallback = $("#form-fallback");
      if (status) {
        status.textContent = "";
        status.classList.remove("is-error");
      }
      if (fallback) {
        fallback.hidden = true;
        fallback.innerHTML = "";
      }

      const honeypot = $("#quote-website");
      if (honeypot && honeypot.value.trim()) {
        // Silently stop obvious bots without claiming a successful submission.
        return;
      }

      let firstInvalid = null;
      Object.keys(fields).forEach((name) => {
        if (!validateField(name) && !firstInvalid) firstInvalid = fields[name].input;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        if (status) {
          status.textContent = "يرجى تصحيح الحقول المطلوبة قبل الإرسال.";
          status.classList.add("is-error");
        }
        return;
      }

      const name = fields.name.input.value.trim();
      const rawPhone = fields.phone.input.value;
      const phone = normalisePhone(rawPhone);
      const selection = getCatalogItem(fields.product.input.value);
      const notes = ($("#quote-notes") && $("#quote-notes").value.trim()) || "";

      const message = [
        (cfg.whatsapp && cfg.whatsapp.quoteIntro) ||
          "مرحبًا Watch Point، أرغب في طلب عرض سعر:",
        "",
        "الاسم: " + name,
        "رقم الهاتف: " + phone,
        "المنتج/الباقة: " + (selection ? selection.label : fields.product.input.value),
        notes ? "ملاحظات: " + notes : null,
        "",
        "أرسلت من موقع Watch Point."
      ]
        .filter((line) => line !== null)
        .join("\n");

      const url = buildWhatsAppUrl(message);
      const opened = window.open(url, "_blank");
      if (opened) opened.opener = null;

      trackEvent("quote_request", {
        method: "whatsapp",
        item: selection ? selection.label : "غير محدد",
        item_type: selection ? selection.type : "unknown"
      });

      if (!opened) {
        if (status) {
          status.textContent =
            (cfg.ui && cfg.ui.formBlockedMessage) ||
            "تعذّر فتح واتساب تلقائيًا. استخدم الرابط الظاهر بالأسفل.";
          status.classList.add("is-error");
        }
        if (fallback) {
          fallback.innerHTML =
            '<p>اضغط على الرابط التالي لفتح واتساب وإرسال الرسالة الجاهزة:</p>' +
            '<a href="' +
            escapeHtml(url) +
            '" target="_blank" rel="noopener noreferrer">فتح واتساب وإرسال الطلب</a>';
          fallback.hidden = false;
        }
      } else if (status) {
        status.textContent =
          (cfg.ui && cfg.ui.formSuccessMessage) ||
          "تم تجهيز رسالة الطلب. أكمل الإرسال من نافذة واتساب. لا تُحفظ بياناتك على هذا الموقع.";
      }

      if (!whatsappNumber) {
        const copied = await copyText(message);
        showToast(
          copied
            ? (cfg.ui && cfg.ui.whatsappUnconfiguredMessage) ||
                "لم يُضبط رقم واتساب الشركة بعد. تم نسخ الرسالة لإرسالها للرقم المعتمد."
            : "لم يُضبط رقم واتساب الشركة بعد. انسخ الرسالة وأرسلها للرقم المعتمد."
        );
      }

      form.reset();
      Object.keys(fields).forEach((key) => setError(key, ""));
    });
  }

  /* --------------------------- WhatsApp / contact ------------------------- */

  function initContactDetails() {
    const contact = cfg.contact || {};
    const phone = String(contact.phone || "").trim();
    const email = String(contact.email || "").trim();
    const hours = String(contact.workingHours || "").trim();
    const address = String(contact.address || "").trim();
    const serviceArea = String(contact.serviceArea || "مصر").trim();

    const phoneItem = $("#contact-phone-item");
    const phonePending = $("#contact-phone-pending");
    const phoneValue = $("#contact-phone-value");

    const topBarCallBtn = $("#top-bar-call-btn");
    const topBarPhoneVal = $("#top-bar-phone-val");
    const headerPhoneBtn = $("#header-phone-btn");
    const headerPhoneText = $("#header-phone-text");

    if (phone) {
      const telHref = "tel:" + phone.replace(/[^\d+]/g, "");
      const displayVal = contact.phoneDisplay || phone;

      if (topBarCallBtn) topBarCallBtn.href = telHref;
      if (topBarPhoneVal) topBarPhoneVal.textContent = displayVal;
      if (headerPhoneBtn) headerPhoneBtn.href = telHref;
      if (headerPhoneText) headerPhoneText.textContent = displayVal;

      if (phoneItem && phonePending) {
        phoneItem.hidden = false;
        phonePending.hidden = true;
        phoneItem.href = telHref;
        if (phoneValue) phoneValue.textContent = displayVal;
      }
    } else {
      if (topBarPhoneVal) topBarPhoneVal.textContent = "طلب اتصال هاتفي";
      if (headerPhoneText) headerPhoneText.textContent = "اتصال مباشر";
    }

    const emailItem = $("#contact-email-item");
    const emailValue = $("#contact-email-value");
    if (emailItem && email) {
      emailItem.hidden = false;
      emailItem.href = "mailto:" + email;
      if (emailValue) emailValue.textContent = email;
    }

    const hoursItem = $("#contact-hours-item");
    const hoursValue = $("#contact-hours-value");
    if (hoursItem && hours) {
      hoursItem.hidden = false;
      if (hoursValue) hoursValue.textContent = hours;
    }

    const areaValue = $("#contact-area-value");
    if (areaValue) areaValue.textContent = serviceArea;

    const contactNote = $("#contact-note");
    if (contactNote && address) contactNote.textContent = address;

    const footerPhone = $("#footer-phone-item");
    const footerPhoneLink = $("#footer-phone-link");
    const footerPhoneValue = $("#footer-phone-value");
    if (footerPhone && phone) {
      footerPhone.hidden = false;
      if (footerPhoneLink) footerPhoneLink.href = "tel:" + phone.replace(/[^\d+]/g, "");
      if (footerPhoneValue) footerPhoneValue.textContent = contact.phoneDisplay || phone;
    }

    const footerEmail = $("#footer-email-item");
    const footerEmailLink = $("#footer-email-link");
    const footerEmailValue = $("#footer-email-value");
    if (footerEmail && email) {
      footerEmail.hidden = false;
      if (footerEmailLink) footerEmailLink.href = "mailto:" + email;
      if (footerEmailValue) footerEmailValue.textContent = email;
    }

    const footerContact = $(".footer-contact");
    if (footerContact && address) {
      const list = footerContact.querySelector("ul");
      if (list) {
        const item = doc.createElement("li");
        item.innerHTML =
          '<a href="#contact"><svg class="icon" aria-hidden="true"><use href="#icon-pin"/></svg><span></span></a>';
        item.querySelector("span").textContent = address;
        list.insertBefore(item, list.firstChild);
      }
    }
  }

  function initWhatsAppLinks() {
    $$("[data-wa-message]").forEach((link) => {
      const message = link.dataset.waMessage || defaultWhatsAppMessage();
      link.href = buildWhatsAppUrl(message);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });

    doc.addEventListener("click", (event) => {
      const link = event.target.closest("[data-wa-message]");
      if (!link) return;

      const message = link.dataset.waMessage || defaultWhatsAppMessage();
      const freshUrl = buildWhatsAppUrl(message);
      if (link.getAttribute("href") !== freshUrl) {
        link.href = freshUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      const item = link.dataset.waItem || "general";
      const placement = link.dataset.waPlacement || "whatsapp_link";

      trackEvent("whatsapp_click", { placement, item });

      if (!whatsappNumber) {
        copyText(message).then((copied) => {
          if (!copied) return;
          showToast(
            (cfg.ui && cfg.ui.whatsappUnconfiguredMessage) ||
              "لم يُضبط رقم واتساب الشركة بعد. تم نسخ الرسالة لإرسالها للرقم المعتمد."
          );
        });
      }
    });
  }

  function initAnalyticsLinks() {
    doc.addEventListener("click", (event) => {
      const target = event.target.closest("[data-analytics]");
      if (!target) return;
      if (target.matches("[data-wa-message]")) return;
      if (target.matches("[data-select-package]")) return;
      trackEvent("cta_click", {
        cta: target.dataset.analytics,
        text: (target.textContent || "").trim().slice(0, 80)
      });
    });
  }

  function initPackageSelection() {
    doc.addEventListener("click", (event) => {
      const link = event.target.closest("[data-select-package]");
      if (!link || !state.catalog.packages.length) return;

      const select = $("#quote-product");
      if (!select) return;

      const pack = state.catalog.packages.find(
        (item) => item.id === link.dataset.selectPackage || item.slug === link.dataset.selectPackage
      );
      if (!pack) return;

      select.value = pack.id;
      select.dispatchEvent(new Event("change", { bubbles: true }));

      const status = $("#form-status");
      if (status) {
        status.textContent = "تم اختيار «" + pack.name + "». أكمل بياناتك لإرسال الطلب.";
        status.classList.remove("is-error");
      }

      trackEvent("package_select", { package: pack.name });
    });
  }

  /* -------------------------------- Analytics ----------------------------- */

  function initAnalytics() {
    const analytics = cfg.analytics || {};
    const measurementId = String(analytics.measurementId || "").trim();
    const consentButton = $("#open-consent");
    const banner = $("#consent-banner");

    if (!measurementId || !cfg.features || cfg.features.analytics === false) {
      if (consentButton) consentButton.hidden = true;
      return;
    }

    if (consentButton) consentButton.hidden = false;

    let stored = null;
    try {
      stored = window.localStorage.getItem(analytics.consentStorageKey || "wp_analytics_consent_v1");
    } catch (error) {
      stored = null;
    }

    const needsConsent = analytics.requireConsent !== false && cfg.features.consentBanner !== false;

    if (!needsConsent) {
      loadAnalytics(measurementId);
      return;
    }

    if (stored === "accepted") {
      state.consent = "accepted";
      loadAnalytics(measurementId);
    } else if (stored === "denied") {
      state.consent = "denied";
    } else if (banner) {
      banner.hidden = false;
    }

    const save = (value) => {
      state.consent = value;
      try {
        window.localStorage.setItem(
          analytics.consentStorageKey || "wp_analytics_consent_v1",
          value
        );
      } catch (error) {
        /* storage can be unavailable in private mode */
      }
      if (banner) banner.hidden = true;
    };

    const accept = $("#consent-accept");
    const decline = $("#consent-decline");

    if (accept) {
      accept.addEventListener("click", () => {
        save("accepted");
        loadAnalytics(measurementId);
      });
    }

    if (decline) {
      decline.addEventListener("click", () => {
        save("denied");
        trackEvent("analytics_declined");
      });
    }

    if (consentButton && banner) {
      consentButton.addEventListener("click", () => {
        banner.hidden = false;
      });
    }
  }

  function loadAnalytics(measurementId) {
    if (state.gaLoaded) return;
    if (!cfg.features || cfg.features.analytics === false) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    const script = doc.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    script.onload = () => {
      state.gaLoaded = true;
      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        anonymize_ip: true,
        send_page_view: true,
        debug_mode: Boolean(cfg.analytics && cfg.analytics.debug)
      });
      trackEvent("analytics_ready", { measurement_id: measurementId });
    };
    script.onerror = () => {
      if (cfg.analytics && cfg.analytics.debug) {
        console.warn("[Watch Point] Google Analytics could not be loaded.");
      }
    };
    doc.head.appendChild(script);
  }

  function initFaqTracking() {
    const faq = $("#faq");
    if (!faq) return;

    faq.addEventListener(
      "toggle",
      (event) => {
        const item = event.target;
        if (!(item instanceof HTMLDetailsElement) || !item.open) return;
        const summary = item.querySelector("summary span");
        trackEvent("faq_open", {
          question: summary ? summary.textContent.trim().slice(0, 120) : "FAQ"
        });
      },
      true
    );
  }

  function initCanonical() {
    const siteUrl = String((cfg.site && cfg.site.url) || "").trim();
    if (!siteUrl) return;

    try {
      const base = siteUrl.replace(/\/$/, "") + "/";
      const dirPath = window.location.pathname.replace(/^\/+/, "").replace(/[^/]*$/, "");
      const pageBase = base + dirPath;
      const canonical = $('link[rel="canonical"]');
      if (canonical) {
        const path = canonical.getAttribute("href") || "./";
        const absolute = new URL(path, pageBase).href;
        canonical.href = absolute;

        const ogUrl = $('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute("content", absolute);

        const ogImage = $('meta[property="og:image"]');
        if (ogImage && !/^https?:\/\//i.test(ogImage.content)) {
          ogImage.setAttribute("content", new URL(ogImage.content, pageBase).href);
        }

        const twitterImage = $('meta[name="twitter:image"]');
        if (twitterImage && !/^https?:\/\//i.test(twitterImage.content)) {
          twitterImage.setAttribute("content", new URL(twitterImage.content, pageBase).href);
        }
      }
    } catch (error) {
      /* ignore malformed site URL */
    }
  }

  /* --------------------------------- Init --------------------------------- */

  async function init() {
    setYear();
    initMobileMenu();
    initHeaderScroll();
    initScrollProgress();
    initScrollSpy();
    initContactDetails();
    initWhatsAppLinks();
    initAnalyticsLinks();
    initPackageSelection();
    initAnalytics();
    initReveal();
    initFaqTracking();
    initCanonical();

    try {
      if (window.WPData && typeof window.WPData.getCatalog === "function") {
        state.catalog = await window.WPData.getCatalog();
        if (!state.catalog.brands) {
          state.catalog.brands = window.WP_BRANDS || [];
        }
        if (!state.catalog.banners || !state.catalog.banners.length) {
          state.catalog.banners = window.WP_BANNERS || [];
        }
        if (!state.catalog.ticker) {
          state.catalog.ticker = window.WP_TICKER || null;
        }
      } else {
        state.catalog = {
          categories: window.WP_CATEGORIES || [],
          products: window.WP_PRODUCTS || [],
          packages: window.WP_PACKAGES || [],
          brands: window.WP_BRANDS || [],
          banners: window.WP_BANNERS || [],
          ticker: window.WP_TICKER || null
        };
      }
    } catch (error) {
      console.warn("[Watch Point] Catalog could not load. Using local data.", error);
      state.catalog = {
        categories: window.WP_CATEGORIES || [],
        products: window.WP_PRODUCTS || [],
        packages: window.WP_PACKAGES || [],
        brands: window.WP_BRANDS || [],
        banners: window.WP_BANNERS || [],
        ticker: window.WP_TICKER || null
      };
    }

    renderTopTicker();
    loadSavedToolsState();
    renderPromoBanners();
    initProductTools();
    initProductCardActions();
    initProjectsFilter();
    initStickyCategoryBar();
    initQuickViewModal();
    initMobileActionDock();
    renderPackages();
    renderBrands();
    initQuoteForm();
  }

  /* -------- Product Card 3 Tools: Wishlist, Compare, Similar Drawer ------- */

  function renderTopTicker() {
    const bar = $("#top-promo-bar");
    const track = $("#top-ticker-track");
    const badgeTextEl = $("#top-ticker-badge-text");
    if (!bar || !track) return;

    const ticker = (state.catalog && state.catalog.ticker) || window.WP_TICKER || {
      enabled: true,
      badgeText: "Watch Point",
      speedSeconds: 36,
      items: [
        "دعم فني",
        "خدمة 24/7",
        "اسألنا عن أي حاجة عاوز تفهمها",
        "موردين لجميع الماركات المعتمدة",
        "منذ 2012",
        "خبرة على أعلى مستوى",
        "عقود صيانة دائمة",
        "نوفر لك كل احتياجاتك",
        "IOT",
        "Smart Homes",
        "Green Houses"
      ]
    };

    if (ticker.enabled === false) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;
    if (badgeTextEl && ticker.badgeText) {
      badgeTextEl.textContent = ticker.badgeText;
    }

    const items = Array.isArray(ticker.items) && ticker.items.length ? ticker.items : [];
    if (!items.length) return;

    const duration = Number(ticker.speedSeconds) > 8 ? Number(ticker.speedSeconds) : 36;
    track.style.setProperty("--ticker-duration", duration + "s");

    const buildGroupHtml = (isClone) =>
      `<div class="top-ticker-group"${isClone ? ' aria-hidden="true"' : ""}>` +
      items
        .map(
          (phrase) =>
            `<span class="top-ticker-item">${escapeHtml(phrase)}</span><span class="top-ticker-sep" aria-hidden="true">✦</span>`
        )
        .join("") +
      `</div>`;

    track.innerHTML = buildGroupHtml(false) + buildGroupHtml(true);
  }

  function loadSavedToolsState() {
    try {
      const savedWish = JSON.parse(localStorage.getItem("wp_wishlist_v1") || "[]");
      if (Array.isArray(savedWish)) state.wishlist = savedWish.filter(Boolean);
    } catch (e) {
      state.wishlist = [];
    }
    try {
      const savedComp = JSON.parse(localStorage.getItem("wp_compare_v1") || "[]");
      if (Array.isArray(savedComp)) state.compareList = savedComp.filter(Boolean);
    } catch (e) {
      state.compareList = [];
    }
    syncToolsBadgesAndButtons();
  }

  function saveToolsState() {
    try {
      localStorage.setItem("wp_wishlist_v1", JSON.stringify(state.wishlist));
      localStorage.setItem("wp_compare_v1", JSON.stringify(state.compareList));
    } catch (e) {
      /* ignore storage errors */
    }
  }

  function formatCleanCardPrice(rawPrice, currency) {
    if (rawPrice !== null && rawPrice !== undefined && rawPrice !== "" && Number.isFinite(Number(rawPrice))) {
      const formatted = Number(rawPrice).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return (currency === "USD" ? "USD " : "LE ") + formatted;
    }
    return "اطلب السعر";
  }

  function syncToolsBadgesAndButtons() {
    const wishBadge = $("#wishlist-count-badge");
    if (wishBadge) {
      wishBadge.textContent = String(state.wishlist.length);
      wishBadge.hidden = state.wishlist.length === 0;
    }

    const compBadge = $("#compare-count-badge");
    if (compBadge) {
      compBadge.textContent = String(state.compareList.length);
      compBadge.hidden = state.compareList.length === 0;
    }

    $$('[data-card-tool="wishlist"]').forEach((btn) => {
      const pid = btn.dataset.productId;
      const active = state.wishlist.includes(pid);
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.setAttribute("data-tooltip", active ? "إزالة من المفضلة" : "أضف للمفضلة");
    });

    $$('[data-card-tool="compare"]').forEach((btn) => {
      const pid = btn.dataset.productId;
      const active = state.compareList.includes(pid);
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.setAttribute("data-tooltip", active ? "مضاف للمقارنة" : "قارن المنتج");
    });

    renderCompareFloatBar();
  }

  function toggleWishlist(productId) {
    if (!productId) return;
    const product = (state.catalog.products || []).find((p) => p.id === productId);
    const idx = state.wishlist.indexOf(productId);
    if (idx > -1) {
      state.wishlist.splice(idx, 1);
      showToast("تمت إزالة المنتج من سلة المفضلة");
    } else {
      state.wishlist.push(productId);
      showToast("تمت إضافة «" + (product ? product.name : "المنتج") + "» إلى سلة المفضلة ♥");
    }
    saveToolsState();
    syncToolsBadgesAndButtons();
    const drawer = $("#wishlist-drawer");
    if (drawer && !drawer.hidden) {
      renderWishlistDrawer();
    }
    trackEvent("wishlist_toggle", { product_id: productId, count: state.wishlist.length });
  }

  function openWishlistDrawer() {
    const drawer = $("#wishlist-drawer");
    if (!drawer) return;
    closeSimilarDrawer();
    renderWishlistDrawer();
    drawer.hidden = false;
    doc.body.style.overflow = "hidden";
  }

  function closeWishlistDrawer() {
    const drawer = $("#wishlist-drawer");
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    doc.body.style.overflow = "";
  }

  function renderWishlistDrawer() {
    const listEl = $("#wishlist-drawer-list");
    const footEl = $("#wishlist-drawer-foot");
    const waBtn = $("#wishlist-wa-btn");
    const subEl = $("#wishlist-drawer-subtitle");
    if (!listEl) return;

    const allProducts = state.catalog.products || [];
    const items = state.wishlist
      .map((id) => allProducts.find((p) => p.id === id))
      .filter(Boolean);

    if (subEl) {
      subEl.textContent = items.length
        ? items.length + " منتج محفوظ في سلة المفضلة"
        : "المنتجات المحفوظة للمراجعة وطلب السعر";
    }

    if (!items.length) {
      if (footEl) footEl.hidden = true;
      listEl.innerHTML = `
        <div class="drawer-empty-state">
          <span class="drawer-empty-icon"><svg class="icon" aria-hidden="true"><use href="#icon-heart"/></svg></span>
          <h4>سلة المفضلة فارغة حاليًا</h4>
          <p>اضغط على رمز القلب (♥) أعلى أي منتج لحفظه هنا ومراجعته أو طلب عرض سعر مجمع في أي وقت.</p>
        </div>
      `;
      return;
    }

    if (footEl) footEl.hidden = false;
    if (waBtn) {
      const msgLines = [
        "مرحبًا Watch Point، أرغب في طلب عرض سعر للمنتجات المحفوظة في سلة المفضلة:",
        "",
        ...items.map((p, i) => `${i + 1}) ${p.name} (${categoryName(p.categoryId)})`),
        "",
        "أرسلت من موقع Watch Point."
      ];
      waBtn.href = buildWhatsAppUrl(msgLines.join("\n"));
    }

    listEl.innerHTML = items
      .map((item) => {
        const catLabel = categoryName(item.categoryId);
        const priceText = formatCleanCardPrice(item.price, item.priceCurrency);
        const url = getProductDetailsUrl(item);
        return `
          <div class="similar-item-card wishlist-item-card" data-drawer-product="${escapeHtml(item.id)}" data-url="${escapeHtml(url)}">
            <button type="button" class="wishlist-remove-item" data-wishlist-remove="${escapeHtml(item.id)}" title="إزالة من المفضلة" aria-label="إزالة ${escapeHtml(item.name)} من المفضلة">
              <svg class="icon" aria-hidden="true"><use href="#icon-x"/></svg>
            </button>
            <div class="similar-item-info">
              <span class="similar-item-cat">${escapeHtml(catLabel)}</span>
              <h4 class="similar-item-title">${escapeHtml(item.name)}</h4>
              <span class="similar-item-price" dir="ltr">${escapeHtml(priceText)}</span>
            </div>
            <div class="similar-item-thumb">
              <img src="${escapeHtml(resolveImage(item.image))}" alt="${escapeHtml(item.name)}" width="72" height="72" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(productFallbackImage(item))}'">
            </div>
          </div>
        `;
      })
      .join("");
  }

  function openSimilarDrawer(productId) {
    const drawer = $("#similar-drawer");
    const listEl = $("#similar-drawer-list");
    const sourceBanner = $("#similar-source-banner");
    if (!drawer || !listEl) return;

    closeWishlistDrawer();

    const allProducts = state.catalog.products || [];
    const current = allProducts.find((p) => p.id === productId) || allProducts[0];
    if (!current) return;

    // 1. Exact same subcategory
    const sameSub = allProducts.filter(
      (p) => p.id !== current.id && p.categoryId === current.categoryId
    );
    // 2. Same main category
    const sameMain = allProducts.filter(
      (p) =>
        p.id !== current.id &&
        p.categoryId !== current.categoryId &&
        p.mainCategoryId &&
        p.mainCategoryId === current.mainCategoryId
    );
    // 3. Closely related products from other categories so list is always rich
    const others = allProducts.filter(
      (p) =>
        p.id !== current.id &&
        !sameSub.includes(p) &&
        !sameMain.includes(p)
    );

    const similarItems = [...sameSub, ...sameMain, ...others].slice(0, 12);

    if (sourceBanner) {
      sourceBanner.innerHTML = `
        <div class="similar-source-inner">
          <span class="similar-source-label">منتجات مرتبطة ومشابهة لـ:</span>
          <strong class="similar-source-name">${escapeHtml(current.name)}</strong>
        </div>
      `;
    }

    listEl.innerHTML = similarItems
      .map((item) => {
        const subcatLabel = categoryName(item.categoryId);
        const specBadge =
          Array.isArray(item.specs) && item.specs.length
            ? item.specs[0].split(" ").slice(0, 3).join(" ")
            : subcatLabel;
        const topLabel = subcatLabel || specBadge;
        const priceText = formatCleanCardPrice(item.price, item.priceCurrency);
        const url = getProductDetailsUrl(item);

        return `
          <a href="${escapeHtml(url)}" class="similar-item-card" data-drawer-product="${escapeHtml(item.id)}" data-url="${escapeHtml(url)}">
            <div class="similar-item-info">
              <span class="similar-item-cat">${escapeHtml(topLabel)}</span>
              <h4 class="similar-item-title">${escapeHtml(item.name)}</h4>
              <span class="similar-item-price" dir="ltr">${escapeHtml(priceText)}</span>
            </div>
            <div class="similar-item-thumb">
              <img src="${escapeHtml(resolveImage(item.image))}" alt="${escapeHtml(item.name)}" width="72" height="72" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(productFallbackImage(item))}'">
            </div>
          </a>
        `;
      })
      .join("");

    drawer.hidden = false;
    doc.body.style.overflow = "hidden";
    trackEvent("open_similar_drawer", { product_id: current.id });
  }

  function closeSimilarDrawer() {
    const drawer = $("#similar-drawer");
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    doc.body.style.overflow = "";
  }

  function toggleCompare(productId) {
    if (!productId) return;
    const product = (state.catalog.products || []).find((p) => p.id === productId);
    const idx = state.compareList.indexOf(productId);
    if (idx > -1) {
      state.compareList.splice(idx, 1);
      showToast("تمت إزالة المنتج من قائمة المقارنة");
    } else {
      if (state.compareList.length >= 4) {
        showToast("يمكنك مقارنة حتى 4 منتجات في نفس الوقت — قم بإزالة منتج أولاً");
        openCompareModal();
        return;
      }
      state.compareList.push(productId);
      if (state.compareList.length >= 2) {
        showToast("تمت إضافة «" + (product ? product.name : "المنتج") + "» للمقارنة — يمكنك فتح جدول المقارنة الآن");
      } else {
        showToast("تمت إضافة «" + (product ? product.name : "المنتج") + "» للمقارنة — اختر منتجًا آخر للمقارنة بينهما");
      }
    }
    saveToolsState();
    syncToolsBadgesAndButtons();
    const modal = $("#compare-modal");
    if (modal && !modal.hidden) {
      renderCompareModalTable();
    }
    trackEvent("compare_toggle", { product_id: productId, count: state.compareList.length });
  }

  function renderCompareFloatBar() {
    const bar = $("#compare-float-bar");
    const countEl = $("#compare-bar-count");
    const thumbsEl = $("#compare-float-thumbs");
    if (!bar) return;

    const allProducts = state.catalog.products || [];
    const items = state.compareList
      .map((id) => allProducts.find((p) => p.id === id))
      .filter(Boolean);

    if (!items.length) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;
    if (countEl) countEl.textContent = String(items.length);
    if (thumbsEl) {
      thumbsEl.innerHTML = items
        .map(
          (item) => `
            <div class="compare-thumb-pill" title="${escapeHtml(item.name)}">
              <img src="${escapeHtml(resolveImage(item.image))}" alt="${escapeHtml(item.name)}" width="34" height="34" onerror="this.onerror=null;this.src='${escapeHtml(productFallbackImage(item))}'">
              <span>${escapeHtml(item.shortName || item.name)}</span>
              <button type="button" data-compare-remove="${escapeHtml(item.id)}" aria-label="إزالة">×</button>
            </div>
          `
        )
        .join("");
    }
  }

  function openCompareModal() {
    const modal = $("#compare-modal");
    if (!modal) return;
    renderCompareModalTable();
    modal.hidden = false;
    doc.body.style.overflow = "hidden";
  }

  function closeCompareModal() {
    const modal = $("#compare-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    doc.body.style.overflow = "";
  }

  function renderCompareModalTable() {
    const wrap = $("#compare-table-wrap");
    if (!wrap) return;

    const allProducts = state.catalog.products || [];
    const items = state.compareList
      .map((id) => allProducts.find((p) => p.id === id))
      .filter(Boolean);

    if (!items.length) {
      wrap.innerHTML = `
        <div class="drawer-empty-state" style="padding:3rem 1rem;">
          <span class="drawer-empty-icon"><svg class="icon" aria-hidden="true"><use href="#icon-compare"/></svg></span>
          <h4>لا توجد منتجات مضافة للمقارنة</h4>
          <p>اضغط على رمز المقارنة (⇄) أعلى أي منتج لإضافته هنا ومقارنة المواصفات والأسعار جنبًا إلى جنب.</p>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <div class="compare-grid" style="--compare-cols: ${items.length};">
        ${items
          .map((item) => {
            const cat = categoryName(item.categoryId);
            const priceText = formatCleanCardPrice(item.price, item.priceCurrency);
            const specs = Array.isArray(item.specs) ? item.specs : [];
            const waMessage = [
              "مرحبًا Watch Point، أرغب في طلب عرض سعر لهذا المنتج:",
              "المنتج: " + item.name,
              "الفئة: " + cat
            ].join("\n");
            const waUrl = buildWhatsAppUrl(waMessage);
            const detailsUrl = getProductDetailsUrl(item);

            return `
              <div class="compare-col">
                <button type="button" class="compare-col-remove" data-compare-remove="${escapeHtml(item.id)}" title="إزالة من المقارنة">
                  <svg class="icon" aria-hidden="true"><use href="#icon-x"/></svg>
                </button>
                <a href="${escapeHtml(detailsUrl)}" class="compare-col-img" data-compare-nav="${escapeHtml(item.id)}">
                  <img src="${escapeHtml(resolveImage(item.image))}" alt="${escapeHtml(item.name)}" width="160" height="120" onerror="this.onerror=null;this.src='${escapeHtml(productFallbackImage(item))}'">
                </a>
                <span class="compare-col-cat">${escapeHtml(cat)}</span>
                <h4 class="compare-col-title">${escapeHtml(item.name)}</h4>
                <div class="compare-col-price" dir="ltr">${escapeHtml(priceText)}</div>
                <p class="compare-col-desc">${escapeHtml(productShortDesc(item))}</p>
                <div class="compare-col-specs">
                  <strong>المواصفات الفنية:</strong>
                  <ul>
                    ${
                      specs.length
                        ? specs.map((s) => `<li><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg><span>${escapeHtml(s)}</span></li>`).join("")
                        : `<li><span>تُحدد المواصفات التفصيلية في عرض السعر</span></li>`
                    }
                  </ul>
                </div>
                <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn--primary btn--sm btn--block compare-col-cta">
                  <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
                  <span>اطلب عرض سعر</span>
                </a>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function initProductCardActions() {
    const headerWishBtn = $("#header-wishlist-btn");
    if (headerWishBtn) {
      headerWishBtn.addEventListener("click", () => openWishlistDrawer());
    }

    const headerCompBtn = $("#header-compare-btn");
    if (headerCompBtn) {
      headerCompBtn.addEventListener("click", () => openCompareModal());
    }

    const simDrawer = $("#similar-drawer");
    if (simDrawer) {
      simDrawer.addEventListener("click", (event) => {
        if (event.target.closest("[data-similar-close]")) {
          event.preventDefault();
          closeSimilarDrawer();
          return;
        }
        const card = event.target.closest("[data-drawer-product]");
        if (card) {
          event.preventDefault();
          const pid = card.dataset.drawerProduct;
          const prod = (state.catalog.products || []).find((p) => p.id === pid);
          closeSimilarDrawer();
          if (prod) navigateToProductPage(prod, event);
        }
      });
    }

    const wishDrawer = $("#wishlist-drawer");
    if (wishDrawer) {
      wishDrawer.addEventListener("click", (event) => {
        if (event.target.closest("[data-wishlist-close]")) {
          event.preventDefault();
          closeWishlistDrawer();
          return;
        }
        const rmBtn = event.target.closest("[data-wishlist-remove]");
        if (rmBtn) {
          event.preventDefault();
          event.stopPropagation();
          toggleWishlist(rmBtn.dataset.wishlistRemove);
          return;
        }
        const card = event.target.closest("[data-drawer-product]");
        if (card) {
          event.preventDefault();
          const pid = card.dataset.drawerProduct;
          const prod = (state.catalog.products || []).find((p) => p.id === pid);
          closeWishlistDrawer();
          if (prod) navigateToProductPage(prod, event);
        }
      });
    }

    const wishClearBtn = $("#wishlist-clear-btn");
    if (wishClearBtn) {
      wishClearBtn.addEventListener("click", () => {
        state.wishlist = [];
        saveToolsState();
        syncToolsBadgesAndButtons();
        renderWishlistDrawer();
        showToast("تم إفراغ سلة المفضلة");
      });
    }

    const compFloatBar = $("#compare-float-bar");
    if (compFloatBar) {
      compFloatBar.addEventListener("click", (event) => {
        const rmBtn = event.target.closest("[data-compare-remove]");
        if (rmBtn) {
          event.preventDefault();
          toggleCompare(rmBtn.dataset.compareRemove);
          return;
        }
      });
    }

    const compOpenBtn = $("#compare-open-modal-btn");
    if (compOpenBtn) {
      compOpenBtn.addEventListener("click", () => openCompareModal());
    }

    const compClearBtn = $("#compare-clear-btn");
    if (compClearBtn) {
      compClearBtn.addEventListener("click", () => {
        state.compareList = [];
        saveToolsState();
        syncToolsBadgesAndButtons();
        showToast("تم مسح قائمة المقارنة");
      });
    }

    const compModal = $("#compare-modal");
    if (compModal) {
      compModal.addEventListener("click", (event) => {
        if (event.target.closest("[data-compare-close]")) {
          event.preventDefault();
          closeCompareModal();
          return;
        }
        const rmBtn = event.target.closest("[data-compare-remove]");
        if (rmBtn) {
          event.preventDefault();
          toggleCompare(rmBtn.dataset.compareRemove);
          return;
        }
        const navLink = event.target.closest("[data-compare-nav]");
        if (navLink) {
          event.preventDefault();
          const pid = navLink.dataset.compareNav;
          const prod = (state.catalog.products || []).find((p) => p.id === pid);
          closeCompareModal();
          if (prod) navigateToProductPage(prod, event);
        }
      });
    }

    const compModalClear = $("#compare-modal-clear");
    if (compModalClear) {
      compModalClear.addEventListener("click", () => {
        state.compareList = [];
        saveToolsState();
        syncToolsBadgesAndButtons();
        renderCompareModalTable();
      });
    }

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSimilarDrawer();
        closeWishlistDrawer();
        closeCompareModal();
      }
    });
  }

  function initProjectsFilter() {
    const bar = $(".projects-filter-bar");
    const grid = $("#projects-grid");
    if (!bar || !grid) return;

    bar.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-project-filter]");
      if (!btn) return;
      const filter = btn.dataset.projectFilter;
      $$(".project-filter-btn", bar).forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const cards = $$(".project-card", grid);
      cards.forEach((card) => {
        const cat = card.dataset.projectCat;
        if (filter === "all" || cat === filter) {
          card.classList.remove("is-hidden");
        } else {
          card.classList.add("is-hidden");
        }
      });
      trackEvent("filter_projects", { filter });
    });

    grid.addEventListener("click", (event) => {
      const quoteBtn = event.target.closest("[data-project-quote]");
      if (!quoteBtn) return;
      const projName = quoteBtn.dataset.projectQuote;
      const notesEl = $("#quote-notes");
      if (notesEl && projName) {
        notesEl.value = "طلب دراسة ومعاينة لمشروع مماثل: " + projName;
      }
    });
  }

  function initStickyCategoryBar() {
    const bar = $("#sticky-cat-bar");
    const storeSec = $("#store");
    const fesGrid = $("#fes-cats-grid");
    if (!bar || !storeSec) return;

    bar.hidden = false;

    bar.addEventListener("click", (event) => {
      const pill = event.target.closest("[data-sticky-cat]");
      if (!pill) return;
      state.activeCategory = pill.dataset.stickyCat;
      state.activeSubcategory = "";
      renderFesCats();
      renderFesSubcats();
      renderChips();
      renderProducts();

      const targetEl = $("#fes-subcats-bar") && !$("#fes-subcats-bar").hidden
        ? $("#fes-subcats-bar")
        : $("#product-grid");
      if (targetEl) {
        const y = targetEl.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
    });

    const updateVisibility = () => {
      const storeRect = storeSec.getBoundingClientRect();
      const catsBottom = fesGrid ? fesGrid.getBoundingClientRect().bottom : storeRect.top + 200;
      const shouldShow = catsBottom < 70 && storeRect.bottom > 260;
      bar.classList.toggle("is-visible", shouldShow);
    };

    window.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();
  }

  function openQuickView(productId) {
    const modal = $("#quick-view-modal");
    const content = $("#qv-content");
    if (!modal || !content) return;

    const product = (state.catalog.products || []).find((p) => p.id === productId);
    if (!product) return;

    const category = categoryName(product.categoryId);
    const waMessage = [
      (cfg.whatsapp && cfg.whatsapp.productIntro) ||
        "مرحبًا Watch Point، أرغب في طلب عرض سعر لهذا المنتج:",
      "",
      "المنتج: " + product.name,
      "الفئة: " + category,
      "",
      "أرسلت من موقع Watch Point."
    ].join("\n");
    const waUrl = buildWhatsAppUrl(waMessage);
    const cleanSlug = String(product.slug || product.id || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const detailsUrl = cleanSlug ? "catalog/product-" + cleanSlug + ".html" : "product.html?id=" + encodeURIComponent(product.id);

    content.innerHTML = `
      <div class="qv-grid">
        <div class="qv-media-box">
          <img src="${escapeHtml(resolveImage(product.image))}" alt="${escapeHtml(product.imageAlt || product.name)}" width="600" height="450" onerror="this.onerror=null;this.src='${escapeHtml(productFallbackImage(product))}'">
        </div>
        <div class="qv-info">
          <span class="qv-cat-badge">
            <svg class="icon" style="width:14px;height:14px;" aria-hidden="true"><use href="#icon-shield"/></svg>
            ${escapeHtml(category)}
          </span>
          <h2 class="qv-title" id="qv-title">${escapeHtml(product.name)}</h2>
          <p class="qv-desc">${escapeHtml(productShortDesc(product))}</p>
          ${
            (product.specs || []).length
              ? `<h4 class="qv-specs-title">المواصفات الفنية الكاملة:</h4>
                 <ul class="qv-specs-list">
                   ${(product.specs || [])
                     .map(
                       (spec) => `
                         <li>
                           <svg class="icon" aria-hidden="true"><use href="#icon-check-circle"/></svg>
                           <span>${escapeHtml(spec)}</span>
                         </li>`
                     )
                     .join("")}
                 </ul>`
              : ""
          }
          <div class="price-row" style="margin-bottom:0.75rem;">
            ${renderPriceBox(product.price, product.priceCurrency, false)}
          </div>
          <div class="qv-actions">
            <a class="btn btn--whatsapp" href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer">
              <svg class="icon" aria-hidden="true"><use href="#icon-whatsapp"/></svg>
              اطلب عرض سعر عبر واتساب
            </a>
            <a class="btn btn--primary" href="#contact" data-qv-select="${escapeHtml(product.id)}">
              طلب معاينة لهذا المنتج
            </a>
            <a class="btn btn--outline" href="${escapeHtml(detailsUrl)}" data-qv-fullpage="${escapeHtml(detailsUrl)}" data-qv-pid="${escapeHtml(product.id)}">
              صفحة المنتج الكاملة ↗
            </a>
          </div>
        </div>
      </div>
    `;

    modal.hidden = false;
    doc.body.style.overflow = "hidden";
  }

  function closeQuickView() {
    const modal = $("#quick-view-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    doc.body.style.overflow = "";
  }

  function initQuickViewModal() {
    const modal = $("#quick-view-modal");
    if (!modal) return;

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-qv-close]")) {
        event.preventDefault();
        closeQuickView();
        return;
      }

      const selectBtn = event.target.closest("[data-qv-select]");
      if (selectBtn) {
        const pid = selectBtn.dataset.qvSelect;
        closeQuickView();
        const selectEl = $("#quote-product");
        if (selectEl && pid) {
          selectEl.value = pid;
        }
        return;
      }

      const fullPageBtn = event.target.closest("[data-qv-fullpage]");
      if (fullPageBtn) {
        event.preventDefault();
        const url = fullPageBtn.dataset.qvFullpage;
        const pid = fullPageBtn.dataset.qvPid;
        fetch(url, { method: "HEAD", cache: "no-store" })
          .then((res) => {
            window.location.href = res && res.ok ? url : "product.html?id=" + encodeURIComponent(pid);
          })
          .catch(() => {
            window.location.href = "product.html?id=" + encodeURIComponent(pid);
          });
      }
    });

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeQuickView();
    });
  }

  function initMobileActionDock() {
    const dock = $("#mobile-action-dock");
    if (!dock) return;

    const contact = cfg.contact || {};
    const phone = String(contact.phone || "").trim();
    const dockPhone = $("#mobile-dock-phone");
    if (dockPhone && phone) {
      dockPhone.href = "tel:" + phone.replace(/[^\d+]/g, "");
    }

    dock.addEventListener("click", (event) => {
      const actionEl = event.target.closest("[data-dock-action]");
      if (!actionEl) return;
      const action = actionEl.dataset.dockAction;

      if (action === "search") {
        const searchInput = $("#product-search") || $("#store-dir-search");
        if (searchInput) {
          event.preventDefault();
          searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => searchInput.focus(), 360);
        }
      } else if (action === "cats") {
        const storeEl = $("#store");
        if (storeEl) {
          event.preventDefault();
          storeEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  }

  function getProductDetailsUrl(product) {
    if (!product) return "#store";
    const cleanSlug = String(product.slug || product.id || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return cleanSlug
      ? "catalog/product-" + cleanSlug + ".html"
      : "product.html?id=" + encodeURIComponent(product.id);
  }

  function navigateToProductPage(product, event) {
    if (!product) return false;
    if (event) event.preventDefault();
    const url = getProductDetailsUrl(product);
    if (url.startsWith("product.html")) {
      window.location.href = url;
      return true;
    }
    fetch(url, { method: "HEAD", cache: "no-store" })
      .then((res) => {
        if (res && res.ok) {
          window.location.href = url;
        } else {
          window.location.href = "product.html?id=" + encodeURIComponent(product.id);
        }
      })
      .catch(() => {
        window.location.href = "product.html?id=" + encodeURIComponent(product.id);
      });
    return true;
  }

  function navigateBannerLink(rawLink, event) {
    const link = String(rawLink || "#store").trim();

    if (link.startsWith("#product:")) {
      const prodId = link.slice(9).trim();
      const prod = (state.catalog.products || []).find((p) => p.id === prodId);
      if (prod) {
        return navigateToProductPage(prod, event);
      }
    }

    if (link.startsWith("#subcat:")) {
      if (event) event.preventDefault();
      const parts = link.slice(8).split(":");
      const catId = (parts[0] || "").trim();
      const subId = (parts[1] || "").trim();
      if (catId) {
        state.activeCategory = catId;
        state.activeSubcategory = subId || "";
        renderFesCats();
        renderFesSubcats();
        renderChips();
        renderProducts();
      }
      const storeEl = doc.getElementById("store");
      if (storeEl) {
        storeEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return true;
    }

    if (link.startsWith("#cat:")) {
      if (event) event.preventDefault();
      const catId = link.slice(5).trim();
      if (catId) {
        state.activeCategory = catId;
        state.activeSubcategory = "";
        renderFesCats();
        renderFesSubcats();
        renderChips();
        renderProducts();
      }
      const storeEl = doc.getElementById("store");
      if (storeEl) {
        storeEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return true;
    }
    return false;
  }

  function renderPromoBanners() {
    const grid = $("#promo-bento-grid");
    if (!grid) return;

    const allBanners =
      state.catalog && state.catalog.banners && state.catalog.banners.length
        ? state.catalog.banners
        : window.WP_BANNERS || [];
    const allProducts =
      state.catalog && state.catalog.products && state.catalog.products.length
        ? state.catalog.products
        : window.WP_PRODUCTS || [];

    const slots = ["right", "main", "left"];

    slots.forEach((slotKey) => {
      const slotEl = grid.querySelector(`[data-promo-slot="${slotKey}"]`);
      if (!slotEl) return;

      // Side slots (right & left): Sequentially showcase curated products across categories
      if ((slotKey === "right" || slotKey === "left") && allProducts.length > 0) {
        slotEl.hidden = false;
        const showcasePool = sortProductsForDisplay(allProducts).slice(0, 30);
        const offset = slotKey === "left" ? Math.max(1, Math.floor(showcasePool.length / 2)) : 0;
        const orderedProducts = showcasePool.map(
          (_, idx) => showcasePool[(idx + offset) % showcasePool.length]
        );

        const slidesHtml = orderedProducts
          .map((prod, idx) => {
            const catLabel = categoryName(prod.categoryId);
            const detailsUrl = getProductDetailsUrl(prod);
            const priceFormatted = formatCleanCardPrice(prod.price, prod.priceCurrency);
            const specsList = Array.isArray(prod.specs) ? prod.specs.slice(0, 2) : [];
            const descText =
              productShortDesc(prod) ||
              specsList.join(" · ") ||
              "توريد وتركيب معتمد بضمان Watch Point";

            return `
              <div class="promo-slide${idx === 0 ? " is-active" : ""}" data-slide-index="${idx}">
                <a href="${escapeHtml(detailsUrl)}" class="promo-product-card" data-banner-link="#product:${escapeHtml(prod.id)}" aria-label="${escapeHtml(prod.name)}">
                  <div class="promo-prod-top">
                    <span class="promo-prod-cat">${escapeHtml(catLabel)}</span>
                    <span class="promo-prod-counter">${idx + 1} / ${orderedProducts.length}</span>
                  </div>
                  <div class="promo-prod-body">
                    <div class="promo-prod-media">
                      <img src="${escapeHtml(resolveImage(prod.image))}" alt="${escapeHtml(prod.imageAlt || prod.name)}" loading="${idx === 0 ? "eager" : "lazy"}" decoding="async" onerror="this.onerror=null;this.src='${escapeHtml(productFallbackImage(prod))}'">
                    </div>
                    <div class="promo-prod-info">
                      <div>
                        <h3 class="promo-prod-title">${escapeHtml(prod.name)}</h3>
                        <p class="promo-prod-desc">${escapeHtml(descText)}</p>
                        ${
                          specsList.length
                            ? `<div class="promo-prod-specs">
                                ${specsList
                                  .map((s) => `<span class="promo-prod-spec-tag">${escapeHtml(s)}</span>`)
                                  .join("")}
                               </div>`
                            : ""
                        }
                      </div>
                      <div class="promo-prod-foot">
                        <span class="promo-prod-price" dir="ltr">${escapeHtml(priceFormatted)}</span>
                        <span class="promo-prod-cta">عرض القطعة ←</span>
                      </div>
                    </div>
                  </div>
                </a>
              </div>
            `;
          })
          .join("");

        const hasMultiple = orderedProducts.length > 1;
        const dotItems = orderedProducts.slice(0, 12);
        const controlsHtml = hasMultiple
          ? `
            <button type="button" class="promo-arrow promo-arrow--prev" data-promo-dir="-1" aria-label="المنتج السابق">
              <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button type="button" class="promo-arrow promo-arrow--next" data-promo-dir="1" aria-label="المنتج التالي">
              <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div class="promo-dots" role="tablist" aria-label="منتجات المعرض">
              ${dotItems
                .map(
                  (_, idx) =>
                    `<button type="button" class="promo-dot${idx === 0 ? " is-active" : ""}" data-promo-dot="${idx}" aria-label="منتج ${idx + 1}"></button>`
                )
                .join("")}
            </div>
          `
          : "";

        slotEl.innerHTML = `<div class="promo-slides-track">${slidesHtml}</div>${controlsHtml}`;

        let activeIdx = 0;
        let timer = null;
        const slideEls = Array.from(slotEl.querySelectorAll(".promo-slide"));
        const dotEls = Array.from(slotEl.querySelectorAll(".promo-dot"));

        const goTo = (nextIdx) => {
          if (!slideEls.length) return;
          activeIdx = (nextIdx + slideEls.length) % slideEls.length;
          slideEls.forEach((el, i) => el.classList.toggle("is-active", i === activeIdx));
          dotEls.forEach((el, i) => el.classList.toggle("is-active", i === activeIdx));
        };

        const startAuto = () => {
          if (!hasMultiple || reducedMotion) return;
          stopAuto();
          timer = window.setInterval(() => {
            goTo(activeIdx + 1);
          }, slotKey === "right" ? 4100 : 4600);
        };

        const stopAuto = () => {
          if (timer) {
            window.clearInterval(timer);
            timer = null;
          }
        };

        slotEl.addEventListener("click", (event) => {
          const dirBtn = event.target.closest("[data-promo-dir]");
          if (dirBtn) {
            event.preventDefault();
            event.stopPropagation();
            goTo(activeIdx + Number(dirBtn.dataset.promoDir));
            startAuto();
            return;
          }

          const dotBtn = event.target.closest("[data-promo-dot]");
          if (dotBtn) {
            event.preventDefault();
            event.stopPropagation();
            goTo(Number(dotBtn.dataset.promoDot));
            startAuto();
            return;
          }

          const linkTarget = event.target.closest("[data-banner-link]");
          if (linkTarget) {
            navigateBannerLink(linkTarget.dataset.bannerLink, event);
          }
        });

        slotEl.addEventListener("mouseenter", stopAuto);
        slotEl.addEventListener("mouseleave", startAuto);
        startAuto();
        return;
      }

      // Main Center Slot: Interactive Smart-Home Banner with Hyperlink Hotspots
      const items = allBanners.filter((b) => (b.slot || "main") === slotKey);
      if (!items.length) {
        slotEl.hidden = true;
        return;
      }
      slotEl.hidden = false;

      const slidesHtml = items
        .map((item, idx) => {
          const href = item.link || "#store";
          let titleHtml = escapeHtml(item.title || "");
          if (item.highlight && item.title && item.title.includes(item.highlight)) {
            const parts = item.title.split(item.highlight);
            titleHtml =
              escapeHtml(parts[0]) +
              `<span class="promo-overlay-highlight">${escapeHtml(item.highlight)}</span>` +
              escapeHtml(parts.slice(1).join(item.highlight));
          } else if (item.highlight) {
            titleHtml += ` <span class="promo-overlay-highlight">${escapeHtml(item.highlight)}</span>`;
          }

          const overlayHtml = item.showOverlay
            ? `<div class="promo-slide-overlay">
                ${item.badge ? `<span class="promo-overlay-badge">${escapeHtml(item.badge)}</span>` : ""}
                ${titleHtml ? `<h3 class="promo-overlay-title">${titleHtml}</h3>` : ""}
                ${item.subtitle ? `<p class="promo-overlay-sub">${escapeHtml(item.subtitle)}</p>` : ""}
              </div>`
            : "";

          const hotspotsHtml =
            slotKey === "main" && Array.isArray(item.hotspots) && item.hotspots.length
              ? `<span class="promo-main-caption">
                   <span class="promo-main-caption-dot" aria-hidden="true"></span>
                   <span>اضغط على أي نقطة مضيئة بالمنزل للانتقال للقطعة المخصصة</span>
                 </span>
                 <div class="promo-hotspots-layer">
                  ${item.hotspots
                    .map((hs) => {
                      const x = Number(hs.x) || 50;
                      const y = Number(hs.y) || 50;
                      const edgeClasses = [
                        x > 72 ? "is-edge-right" : "",
                        x < 28 ? "is-edge-left" : "",
                        y < 28 ? "is-edge-top" : ""
                      ]
                        .filter(Boolean)
                        .join(" ");

                      let matchedProduct = null;
                      if (hs.productId) {
                        matchedProduct = allProducts.find((p) => p.id === hs.productId);
                      } else if (hs.subcatId) {
                        matchedProduct = allProducts.find((p) => p.categoryId === hs.subcatId);
                      } else if (hs.categoryId) {
                        matchedProduct = allProducts.find(
                          (p) => p.mainCategoryId === hs.categoryId || p.categoryId === hs.categoryId
                        );
                      }

                      const hsBannerLink = matchedProduct
                        ? "#product:" + matchedProduct.id
                        : hs.link || (hs.categoryId ? "#cat:" + hs.categoryId : "#store");
                      const hsHref = matchedProduct
                        ? getProductDetailsUrl(matchedProduct)
                        : hsBannerLink;
                      const priceInfo = matchedProduct
                        ? formatCleanCardPrice(matchedProduct.price, matchedProduct.priceCurrency)
                        : null;

                      return `
                        <a href="${escapeHtml(hsHref)}" class="promo-hotspot ${matchedProduct ? "promo-hotspot--product" : ""} ${edgeClasses}" style="left:${x}%;top:${y}%;" data-banner-link="${escapeHtml(hsBannerLink)}" aria-label="${escapeHtml(hs.label || "استكشف القطعة")}">
                          <span class="promo-hotspot-dot"></span>
                          <span class="promo-hotspot-tooltip">
                            ${
                              matchedProduct && matchedProduct.image
                                ? `<img class="hs-thumb" src="${escapeHtml(resolveImage(matchedProduct.image))}" alt="" width="44" height="44" onerror="this.onerror=null;this.src='${escapeHtml(productFallbackImage(matchedProduct))}'">`
                                : ""
                            }
                            <span class="hs-info">
                              <strong class="hs-title">${escapeHtml(hs.label || (matchedProduct && matchedProduct.name) || "")}</strong>
                              <span class="hs-sub">${escapeHtml(hs.sublabel || (matchedProduct && matchedProduct.description) || "")}</span>
                              <span class="hs-foot">
                                ${
                                  priceInfo
                                    ? `<span class="hs-price" dir="ltr">${escapeHtml(priceInfo)}</span>`
                                    : ""
                                }
                                <span class="promo-hotspot-cta">${matchedProduct ? "افتح القطعة ←" : "تصفح القسم ←"}</span>
                              </span>
                            </span>
                          </span>
                        </a>`;
                    })
                    .join("")}
                </div>`
              : "";

          return `
            <div class="promo-slide${idx === 0 ? " is-active" : ""}" data-slide-index="${idx}">
              <a href="${escapeHtml(href)}" class="promo-slide-link" data-banner-link="${escapeHtml(href)}" aria-label="${escapeHtml(item.title || "عرض ترويجي")}" style="display:block;width:100%;height:100%;">
                <img class="promo-slide-img" src="${escapeHtml(resolveImage(item.image))}" alt="${escapeHtml(item.title || "Watch Point")}" loading="${idx === 0 ? "eager" : "lazy"}" decoding="async">
                ${overlayHtml}
              </a>
              ${hotspotsHtml}
            </div>
          `;
        })
        .join("");

      const hasMultiple = items.length > 1;
      const controlsHtml = hasMultiple
        ? `
          <button type="button" class="promo-arrow promo-arrow--prev" data-promo-dir="-1" aria-label="الشريحة السابقة">
            <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <button type="button" class="promo-arrow promo-arrow--next" data-promo-dir="1" aria-label="الشريحة التالية">
            <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div class="promo-dots" role="tablist" aria-label="شرائح البانر">
            ${items
              .map(
                (_, idx) =>
                  `<button type="button" class="promo-dot${idx === 0 ? " is-active" : ""}" data-promo-dot="${idx}" aria-label="شريحة ${idx + 1}"></button>`
              )
              .join("")}
          </div>
        `
        : "";

      slotEl.innerHTML = `<div class="promo-slides-track">${slidesHtml}</div>${controlsHtml}`;

      let activeIdx = 0;
      let timer = null;
      const slideEls = Array.from(slotEl.querySelectorAll(".promo-slide"));
      const dotEls = Array.from(slotEl.querySelectorAll(".promo-dot"));

      const goTo = (nextIdx) => {
        if (!slideEls.length) return;
        activeIdx = (nextIdx + slideEls.length) % slideEls.length;
        slideEls.forEach((el, i) => el.classList.toggle("is-active", i === activeIdx));
        dotEls.forEach((el, i) => el.classList.toggle("is-active", i === activeIdx));
      };

      const startAuto = () => {
        if (!hasMultiple || reducedMotion) return;
        stopAuto();
        timer = window.setInterval(() => {
          goTo(activeIdx + 1);
        }, 6000);
      };

      const stopAuto = () => {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      };

      slotEl.addEventListener("click", (event) => {
        const dirBtn = event.target.closest("[data-promo-dir]");
        if (dirBtn) {
          event.preventDefault();
          event.stopPropagation();
          goTo(activeIdx + Number(dirBtn.dataset.promoDir));
          startAuto();
          return;
        }

        const dotBtn = event.target.closest("[data-promo-dot]");
        if (dotBtn) {
          event.preventDefault();
          event.stopPropagation();
          goTo(Number(dotBtn.dataset.promoDot));
          startAuto();
          return;
        }

        const linkTarget = event.target.closest("[data-banner-link]");
        if (linkTarget) {
          const targetHref = linkTarget.dataset.bannerLink;
          navigateBannerLink(targetHref, event);
        }
      });

      slotEl.addEventListener("mouseenter", stopAuto);
      slotEl.addEventListener("mouseleave", startAuto);
      startAuto();
    });
  }

  function renderBrands() {
    const grid = $("#brands-grid");
    if (!grid) return;

    const brands =
      (state.catalog && state.catalog.brands && state.catalog.brands.length)
        ? state.catalog.brands
        : (window.WP_BRANDS || []);

    if (!brands.length) {
      grid.innerHTML = "";
      return;
    }

    grid.innerHTML = brands
      .map((brand) => `
        <div class="brand-item is-visible">
          <div class="brand-logo-card">
            <img src="${escapeHtml(resolveImage(brand.logo))}"
                 alt="${escapeHtml(brand.name || 'علامة تجارية معتمدة')}"
                 width="200" height="60"
                 loading="lazy" decoding="async">
          </div>
          <span class="brand-name">${escapeHtml(brand.name || '')}</span>
        </div>
      `)
      .join("");

    if (typeof initReveal === "function") {
      initReveal();
    }
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
