/* ==========================================================================
   Watch Point — إعدادات الموقع
   --------------------------------------------------------------------------
   هذا هو الملف الوحيد الذي تحتاجه لتعديل بيانات التواصل والتحليلات.
   لا تضع أرقامًا أو عناوين غير حقيقية. اترك أي قيمة فارغة إذا لم تكن متاحة؛
   ستتعامل الواجهة معها بشكل آمن.
   ========================================================================== */

window.WP_CONFIG = {
  company: {
    name: "Watch Point",
    nameAr: "Watch Point",
    legalName: "Watch Point",
    tagline: "Integrated Security Solutions",
    taglineAr: "حلول أمنية متكاملة",
    description:
      "Watch Point متخصصون في توريد وتركيب كاميرات المراقبة والأنظمة الأمنية والشبكات.",
    logoMark: "assets/images/brand-mark.webp",
    logoFull: "assets/images/watch-point-logo.webp"
  },

  site: {
    // ضع النطاق النهائي قبل النشر، مثال: "https://watchpoint.com".
    // عند تركه فارغًا تعمل الصفحة محليًا وتُستخدم روابط نسبية.
    url: "",
    locale: "ar_EG",
    lang: "ar",
    direction: "rtl",
    themeColor: "#0B1B33",
    ogImage: "assets/images/og-cover.jpg",
    twitterHandle: "",
    defaultOgType: "website"
  },

  contact: {
    // رقم واتساب بصيغة دولية بدون + أو مسافات، مثال: "2010xxxxxxxx".
    // اتركه فارغًا حتى تعتمد الرقم الرسمي. عند تركه فارغًا سيتم نسخ رسالة
    // الطلب وفتح واتساب كرسالة مشاركة بدلًا من إرسالها إلى رقم وهمي.
    whatsappNumber: "",

    // رقم الهاتف الظاهر في قسم التواصل والتذييل.
    phone: "",
    phoneDisplay: "",

    email: "watchpoint2026@gmail.com",
    address: "",
    serviceArea: "مصر",
    workingHours: "",
    responseNote:
      "نرد على الاستفسارات وننسّق موعد المعاينة حسب ساعات العمل والمنطقة."
  },

  whatsapp: {
    defaultMessage:
      "مرحبًا Watch Point، أرغب في الاستفسار عن كاميرات المراقبة والأنظمة الأمنية.",
    quoteIntro: "مرحبًا Watch Point، أرغب في طلب عرض سعر:",
    productIntro: "مرحبًا Watch Point، أرغب في طلب عرض سعر لهذا المنتج:"
  },

  analytics: {
    // ضع معرّف Google Analytics 4 هنا لتفعيل القياس.
    // مثال: "G-XXXXXXXXXX". اتركه فارغًا لتعمل الصفحة دون أي اتصال خارجي.
    measurementId: "",
    requireConsent: true,
    consentStorageKey: "wp_analytics_consent_v1",
    debug: false
  },

  seo: {
    defaultTitle:
      "Watch Point | كاميرات مراقبة وأنظمة أمنية في مصر — توريد وتركيب",
    titleTemplate: "%s | Watch Point",
    defaultDescription:
      "Watch Point لتوريد وتركيب كاميرات المراقبة والأنظمة الأمنية في مصر. معاينة الموقع، عرض سعر واضح، تركيب وبرمجة وصيانة. اطلب عرض سعر عبر واتساب.",
    keywords: [
      "كاميرات مراقبة",
      "تركيب كاميرات مراقبة",
      "أنظمة أمنية",
      "كاميرات IP",
      "كاميرات Wi-Fi",
      "DVR",
      "NVR",
      "إنتركم",
      "أكسيس كنترول",
      "كاميرات مراقبة مصر",
      "Watch Point"
    ],
    areaServed: "مصر",
    knowsAbout: [
      "كاميرات المراقبة الداخلية والخارجية",
      "أنظمة كاميرات IP",
      "أجهزة DVR وNVR",
      "تخزين تسجيلات المراقبة",
      "الإنتركم والتحكم في الدخول",
      "تركيب وبرمجة أنظمة المراقبة"
    ],
    organizationType: "Organization"
  },

  ui: {
    currency: "EGP",
    priceOnRequestLabel: "اطلب آخر سعر",
    demoNotice:
      "المنتجات والأسعار المعروضة تجريبية وقابلة للتعديل. تُحدد الموديلات والمواصفات والسعر النهائي في عرض السعر بعد المعاينة.",
    whatsappUnconfiguredMessage:
      "لم يُضبط رقم واتساب الشركة بعد. نسخنا الرسالة لك لتتمكن من إرسالها للرقم المعتمد.",
    formSuccessMessage:
      "تم تجهيز رسالة الطلب. أكمل الإرسال من نافذة واتساب. لا تُحفظ بياناتك على هذا الموقع.",
    formBlockedMessage:
      "تعذّر فتح واتساب تلقائيًا. استخدم الرابط الظاهر بالأسفل لإكمال الطلب.",
    noResultsTitle: "لا توجد نتائج مطابقة",
    noResultsText:
      "جرّب كلمة بحث أخرى أو اختر «كل المنتجات». يمكنك أيضًا طلب استشارة وسنساعدك في اختيار النظام.",
    searchPlaceholder: "ابحث عن كاميرا، DVR، إنتركم…",
    phonePending: "رقم الهاتف سيُضاف من إعدادات الموقع.",
    emailPending: "البريد الإلكتروني سيُضاف من إعدادات الموقع.",
    addressPending: "بيانات الموقع الجغرافي ستُضاف عند توفرها."
  },

  data: {
    // "local" تعمل بالكامل دون إنترنت.
    // "api" جاهزة لاستبدال البيانات محليًا ببيانات Django REST API مستقبلًا.
    source: "local",
    catalogEndpoint: "" // مثال: "https://erp.example.com/api/catalog/"
  },

  features: {
    search: true,
    filters: true,
    analytics: true,
    consentBanner: true
  }
};
