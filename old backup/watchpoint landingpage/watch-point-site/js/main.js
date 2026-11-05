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
    catalog: { categories: [], products: [], packages: [] },
    activeCategory: "all",
    query: "",
    searchTimer: null,
    toastTimer: null,
    gaLoaded: false,
    selectedItem: null,
    consent: null
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

    return output.replace(/[^\d]/g, "");
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
    const encoded = encodeURIComponent(message);
    return whatsappNumber
      ? "https://wa.me/" + whatsappNumber + "?text=" + encoded
      : "https://wa.me/?text=" + encoded;
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
      const formattedNum = num.toLocaleString("ar-EG");
      return `
        <div class="price-box price-box--numeric">
          <div class="price-top">
            <span class="price-label">السعر:</span>
            <span class="price-badge-stock">متاح للتوريد والتركيب</span>
          </div>
          <div class="price-main">
            <span class="price-amount">${escapeHtml(formattedNum)}</span>
            <span class="price-unit">${escapeHtml(currency === "USD" ? "$" : "ج.م")}</span>
          </div>
          <span class="price-subtext">${isPackage ? "سعر الباقة يشمل التوريد والتركيب والبرمجة" : "شامل التوريد والضمان الفني المعتمد"}</span>
        </div>
      `;
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
    const category = state.catalog.categories.find((item) => item.id === categoryId);
    return category ? category.name : "منتجات";
  }

  function productMatches(product, query, category) {
    if (category && category !== "all" && product.categoryId !== category) return false;
    if (!query) return true;

    const categoryLabel = categoryName(product.categoryId);
    const haystack = normaliseSearch(
      [
        product.name,
        product.shortName,
        product.description,
        categoryLabel,
        (product.specs || []).join(" "),
        (product.keywords || []).join(" ")
      ].join(" ")
    );

    return haystack.includes(query);
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
        count: state.catalog.products.filter(
          (product) => product.categoryId === category.id
        ).length
      }))
    ];

    container.innerHTML = chips
      .map(
        (chip) => `
          <button class="chip${state.activeCategory === chip.id ? " is-active" : ""}"
            type="button" data-filter="${escapeHtml(chip.id)}"
            aria-pressed="${state.activeCategory === chip.id}">
            ${escapeHtml(chip.name)}
            <span class="count">${chip.count}</span>
          </button>`
      )
      .join("");
  }

  function renderProducts() {
    const grid = $("#product-grid");
    const noResults = $("#no-results");
    const countEl = $("#results-count");
    if (!grid) return;

    const products = state.catalog.products.filter((product) =>
      productMatches(product, state.query, state.activeCategory)
    );

    grid.setAttribute("aria-busy", "false");

    if (!products.length) {
      grid.innerHTML = "";
      grid.hidden = true;
      if (noResults) noResults.hidden = false;
      if (countEl) countEl.textContent = "لا توجد نتائج مطابقة";
      trackEvent("search_no_results", { search_term: state.query || state.activeCategory });
      return;
    }

    grid.hidden = false;
    if (noResults) noResults.hidden = true;

    grid.innerHTML = products
      .map((product) => {
        const price = formatPrice(product.price, product.priceCurrency);
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
        const detailsUrl = product.slug ? "catalog/product-" + product.slug + ".html" : "#contact";

        return `
          <article class="product-card" data-product-id="${escapeHtml(product.id)}" data-url="${escapeHtml(detailsUrl)}">
            <a class="product-media" href="${escapeHtml(detailsUrl)}" aria-label="عرض تفاصيل ${escapeHtml(product.name)}">
              <span class="product-cat">${escapeHtml(category)}</span>
              <img src="${escapeHtml(resolveImage(product.image))}"
                alt="${escapeHtml(product.imageAlt || product.name)}"
                width="800" height="600" loading="lazy" decoding="async">
            </a>
            <div class="product-body">
              <h3 class="product-title">
                <a href="${escapeHtml(detailsUrl)}">${escapeHtml(product.name)}</a>
              </h3>
              <p class="product-desc">${escapeHtml(product.description)}</p>
              <ul class="spec-list" aria-label="أبرز مواصفات ومزايا المنتج">
                ${(product.specs || [])
                  .slice(0, 4)
                  .map(
                    (spec) => `
                      <li>
                        <svg class="icon spec-icon" aria-hidden="true"><use href="#icon-check-circle"/></svg>
                        <span>${escapeHtml(spec)}</span>
                      </li>`
                  )
                  .join("")}
              </ul>
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
                    اطلب عرض سعر
                  </a>
                  <a class="details-link" href="${escapeHtml(detailsUrl)}">
                    التفاصيل
                    <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
                  </a>
                </div>
              </div>
            </div>
          </article>`;
      })
      .join("");

    if (countEl) {
      if (state.query) {
        countEl.textContent = products.length + " نتيجة لـ «" + state.query + "»";
      } else if (state.activeCategory !== "all") {
        countEl.textContent =
          products.length + " منتج في " + categoryName(state.activeCategory);
      } else {
        countEl.textContent = products.length + " فئات منتجات";
      }
    }
  }

  function renderPackages() {
    const grid = $("#package-grid");
    if (!grid) return;

    grid.innerHTML = state.catalog.packages
      .map((pack) => {
        const price = formatPrice(pack.price, pack.priceCurrency);
        const featuredClass = pack.featured ? " package-card--featured" : "";

        return `
          <article class="package-card${featuredClass}" data-package-id="${escapeHtml(pack.id)}">
            ${pack.featured ? '<span class="package-badge">باقة مرنة</span>' : ""}
            <div class="package-media">
              <img src="${escapeHtml(resolveImage(pack.image))}"
                alt="${escapeHtml(pack.imageAlt || pack.name)}"
                width="800" height="500" loading="lazy" decoding="async">
            </div>
            <div class="package-body">
              <span class="package-audience">${escapeHtml(pack.audience || "باقة قابلة للتخصيص")}</span>
              <h3 class="package-title">${escapeHtml(pack.name)}</h3>
              <p class="package-desc">${escapeHtml(pack.description)}</p>
              <ul class="package-includes">
                ${(pack.includes || [])
                  .map(
                    (item) => `
                      <li>
                        <svg class="icon" aria-hidden="true"><use href="#icon-check"/></svg>
                        <span>${escapeHtml(item)}</span>
                      </li>`
                  )
                  .join("")}
              </ul>
              <p class="package-note">${escapeHtml(pack.note || "")}</p>
              <div class="package-foot">
                <div class="price-row">
                  ${renderPriceBox(pack.price, pack.priceCurrency, true)}
                </div>
                <a class="btn btn--primary btn--block btn--card"
                  href="#contact" data-select-package="${escapeHtml(pack.id)}"
                  data-analytics="package_quote">
                  اطلب عرض سعر للباقة
                  <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"/></svg>
                </a>
              </div>
            </div>
          </article>`;
      })
      .join("");
  }

  function initProductTools() {
    const grid = $("#product-grid");
    if (!grid) return;

    renderChips();
    renderProducts();

    grid.addEventListener("click", (event) => {
      const card = event.target.closest(".product-card");
      if (!card) return;

      // Don't navigate if clicking WhatsApp button
      if (event.target.closest(".btn--card")) return;

      // Don't duplicate if clicking an explicit link
      if (event.target.closest("a")) return;

      // Don't navigate if selecting text
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;

      const url = card.dataset.url;
      if (url) {
        window.location.href = url;
      }
    });

    const chips = $("#filter-chips");
    if (chips) {
      chips.addEventListener("click", (event) => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;
        state.activeCategory = button.dataset.filter;
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
                productMatches(product, state.query, state.activeCategory)
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
        if (search) {
          search.value = "";
          if (clear) clear.hidden = true;
        }
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

    if (phoneItem && phonePending && phone) {
      phoneItem.hidden = false;
      phonePending.hidden = true;
      phoneItem.href = "tel:" + phone.replace(/[^\d+]/g, "");
      if (phoneValue) phoneValue.textContent = contact.phoneDisplay || phone;
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
      const canonical = $('link[rel="canonical"]');
      if (canonical) {
        const path = canonical.getAttribute("href") || "./";
        const absolute = new URL(path, base + window.location.pathname.replace(/[^/]*$/, "")).href;
        canonical.href = absolute;

        const ogUrl = $('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute("content", absolute);

        const ogImage = $('meta[property="og:image"]');
        if (ogImage && !/^https?:\/\//i.test(ogImage.content)) {
          ogImage.setAttribute("content", new URL(ogImage.content, base).href);
        }

        const twitterImage = $('meta[name="twitter:image"]');
        if (twitterImage && !/^https?:\/\//i.test(twitterImage.content)) {
          twitterImage.setAttribute("content", new URL(twitterImage.content, base).href);
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
      } else {
        state.catalog = {
          categories: window.WP_CATEGORIES || [],
          products: window.WP_PRODUCTS || [],
          packages: window.WP_PACKAGES || []
        };
      }
    } catch (error) {
      console.warn("[Watch Point] Catalog could not load. Using local data.", error);
      state.catalog = {
        categories: window.WP_CATEGORIES || [],
        products: window.WP_PRODUCTS || [],
        packages: window.WP_PACKAGES || []
      };
    }

    initProductTools();
    renderPackages();
    initQuoteForm();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
