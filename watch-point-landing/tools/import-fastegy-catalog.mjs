import fs from "node:fs";
import path from "node:path";

const STORE_PATH = "admin/data/store.json";
const RAW_CATALOG_PATH = "admin/data/fastegy-raw-catalog.json";
const REPORT_PATH = "admin/data/fastegy-import-report.json";

const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
const rawCatalog = JSON.parse(fs.readFileSync(RAW_CATALOG_PATH, "utf8"));

const NOW = new Date().toISOString();

// Map brand IDs in store.brands
const BRAND_IDS = {
  hikvision: "brand-mw43andh-49dc5b",
  hilook: "brand-mw5fz4fo-3da7df",
  ezviz: "brand-ezviz",
  wd: "brand-wd",
  seagate: "brand-seagate",
  dahua: "brand-dahua"
};

function normalizeModelKey(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/^(hikvision|hilook|ezviz|dahua|wd|western digital)\s+/i, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "");
}

function detectBrand(title, slug) {
  const s = `${title} ${slug}`.toLowerCase();
  if (s.includes("ezviz") || s.includes("إيزفيز") || /^hp[457]/i.test(title)) {
    return { id: BRAND_IDS.ezviz, name: "EZVIZ" };
  }
  if (/^(thc-|ipc-|dvr-\d|nvr-\d|ptz-n)/i.test(title) || s.includes("hilook")) {
    return { id: BRAND_IDS.hilook, name: "HiLook" };
  }
  if (/^wd\b/i.test(title) || s.includes("wd-purple")) {
    return { id: BRAND_IDS.wd, name: "Western Digital Purple" };
  }
  return { id: BRAND_IDS.hikvision, name: "Hikvision" };
}

function extractLens(title) {
  const m = String(title).match(/\(([\d.]+\s*(?:-\s*[\d.]+)?\s*mm)\)/i) ||
            String(title).match(/\b([\d.]+(?:\s*-\s*[\d.]+)?\s*mm)\b/i);
  return m ? m[1].replace(/\s+/g, "") : "";
}

function classifyAndDescribeProduct(item) {
  let rawTitle = String(item.t || "").trim();
  const slug = String(item.s || "").trim();

  // Fix known Arabic-only title for EZVIZ DL50FVS
  if (rawTitle === "إيزفيز" && slug.includes("dl50fvs")) {
    rawTitle = "EZVIZ DL50FVS";
  }

  const up = rawTitle.toUpperCase();
  const brand = detectBrand(rawTitle, slug);
  const lens = extractLens(rawTitle);

  let mainCategoryId = "cctv";
  let categoryId = "cctv-ip";
  let shortName = "";
  let description = "";
  const specs = [];
  const keywords = [brand.name, rawTitle];

  // 1. Hikvision Turbo HD Cameras (DS-2CE*) & HiLook Analog (THC-*)
  if (/^DS-2CE/i.test(up) || /^THC-/i.test(up)) {
    mainCategoryId = "cctv";
    categoryId = "cctv-hd";
    const isTurret = /^DS-2CE[57]/i.test(up) || /^THC-T/i.test(up);
    const shapeAr = isTurret ? "توريت/دوم داخلية" : "بوليت خارجية";
    const shapeEn = isTurret ? "Fixed Turret Camera" : "Fixed Bullet Camera";

    let resAr = "2 ميجابكسل (1080p)";
    let resEn = "2 MP";
    if (/10KF|12KF|70KF|72KF|16K0|76K0|78K0|10K0|12K0/i.test(up)) {
      resAr = "3K (5 ميجابكسل)";
      resEn = "3K";
    } else if (/H0T|H5T|5AD|16H|76H|78H|B15|T15|B159|T159/i.test(up)) {
      resAr = "5 ميجابكسل";
      resEn = "5 MP";
    } else if (/U0T|U1T|U7T|U8T/i.test(up)) {
      resAr = "8 ميجابكسل (4K)";
      resEn = "4K (8 MP)";
    } else if (/D0T|D3T|D8T|DF0T|DF3T|DF8T|B12|T12/i.test(up)) {
      resAr = "2 ميجابكسل (1080p)";
      resEn = "2 MP";
    }

    const isColorVu = /DF0T|DF3T|DF8T|KF0T|159|LPS/i.test(up);
    const hasTwoWayAudio = /LPTS/i.test(up);
    const hasBuiltInMic = /LPFS|LPS|MS|S\b/i.test(up) || hasTwoWayAudio;
    const isHybridLight = /LPFS|LPTS|LPS/i.test(up);

    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    specs.push(`النوع: كاميرا مراقبة Turbo HD (${shapeAr})`);
    specs.push(`الدقة: ${resAr}`);
    if (lens) specs.push(`العدسة: ${lens}`);
    if (isColorVu) specs.push("تقنية التصوير الليلي الملون 24/7 ColorVu");
    if (isHybridLight) specs.push("إضاءة هجينة ذكية Smart Hybrid Light (IR + White Light)");
    if (hasTwoWayAudio) specs.push("صوت ثنائي الاتجاه (ميكروفون وسماعة مدمجين)");
    else if (hasBuiltInMic) specs.push("ميكروفون مدمج لنقل الصوت عبر كابل الكواكسيل");
    specs.push("مقاومة للعوامل الجوية والأتربة والمياه IP67");

    const featuresShort = [
      resEn,
      isColorVu ? "ColorVu" : isHybridLight ? "Smart Hybrid Light" : "HD",
      hasTwoWayAudio ? "Two-Way Audio" : hasBuiltInMic ? "Built-in Mic" : "",
      shapeEn
    ].filter(Boolean).join(" ");

    shortName = `كاميرا ${shapeAr} ${resAr}${isColorVu ? " كلر فيو" : ""}${hasBuiltInMic ? " بالصوت" : ""} — ${featuresShort}`;
    description = `كاميرا مراقبة ${shapeAr} من ${brand.name} موديل ${rawTitle} بدقة ${resAr}${lens ? ` وعدسة ${lens}` : ""}${isColorVu ? " مع تصوير ليلي ملون ColorVu" : ""}${hasBuiltInMic ? " وميكروفون مدمج" : ""}.`;
    keywords.push("كاميرا مراقبة", "Turbo HD", shapeAr, resAr);
  }

  // 2. Hikvision PTZ Analog Cameras (DS-2AE*)
  else if (/^DS-2AE/i.test(up)) {
    mainCategoryId = "cctv";
    categoryId = "cctv-hd";
    const zoomMatch = up.match(/2AE\d(\d)(\d{2})/);
    const zoom = zoomMatch ? `${zoomMatch[2]}X` : "25X";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    specs.push("النوع: كاميرا مراقبة متحركة PTZ Turbo HD");
    specs.push(`التقريب البصري: ${zoom} Optical Zoom`);
    specs.push("تغطية شاملة بزاوية دوران 360° ورؤية ليلية بعيدة المدى");
    shortName = `كاميرا متحركة PTZ زووم بصري ${zoom} — Turbo HD Speed Dome`;
    description = `كاميرا مراقبة متحركة PTZ من ${brand.name} موديل ${rawTitle} بزووم بصري ${zoom} لتغطية المساحات الواسعة والأسوار والمصانع.`;
    keywords.push("PTZ", "كاميرا متحركة", zoom);
  }

  // 3. Hikvision & HiLook IP Cameras (DS-2CD*, iDS-2CD*, IPC-*, DS-2XM*, DS-2TD*)
  else if (/^(?:I?DS-2CD|IPC-|DS-2XM|DS-2TD)/i.test(up)) {
    mainCategoryId = "cctv";
    const isWifiCube = /^DS-2CD24/i.test(up) || /-IW/i.test(up);
    categoryId = isWifiCube ? "cctv-wifi" : "cctv-ip";

    const isDome = /^DS-2CD(?:11|13|21|23|27|17)/i.test(up) || /^IPC-[TD]/i.test(up);
    const isVarifocal = /IZ|LIZ|16|17|26|27|7A/i.test(up) || (lens && lens.includes("-"));
    const shapeAr = isWifiCube ? "كاميرا IP داخلية واي فاي" : isDome ? "كاميرا IP دوم/توريت" : "كاميرا IP بوليت خارجية";
    const shapeEn = isWifiCube ? "Wi-Fi Cube Network Camera" : isDome ? "Fixed Dome/Turret Network Camera" : "Bullet Network Camera";

    let resAr = "4 ميجابكسل";
    let resEn = "4 MP";
    const resDigit = up.match(/2CD\d{2}(\d)/i) || up.match(/IPC-[A-Z]\d(\d)/i);
    if (resDigit) {
      const d = resDigit[1];
      if (d === "2") { resAr = "2 ميجابكسل (1080p)"; resEn = "2 MP"; }
      else if (d === "4") { resAr = "4 ميجابكسل (2K)"; resEn = "4 MP"; }
      else if (d === "5") { resAr = "5 ميجابكسل"; resEn = "5 MP"; }
      else if (d === "6") { resAr = "6 ميجابكسل (3K+)"; resEn = "6 MP"; }
      else if (d === "8") { resAr = "8 ميجابكسل (4K Ultra HD)"; resEn = "8 MP (4K)"; }
    }

    const isColorVu = /7G2|7G3|7G0/i.test(up);
    const isAcuSense = /2CD2|6G2|3G2/i.test(up);
    const isHybridLight = /LIU|LIUF|LI\b|LIZ/i.test(up);
    const hasMic = /U\b|UF\b|LIU|ISU|IZU/i.test(up);
    const hasStrobeAlert = /\/SL\b/i.test(up);
    const isThermal = /^DS-2TD/i.test(up);

    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    specs.push(`النوع: ${isThermal ? "كاميرا حرارية Thermal IP Camera" : shapeAr}`);
    specs.push(`الدقة: ${resAr}`);
    if (lens) specs.push(`العدسة: ${lens}${isVarifocal ? " (متغيرة البعد البؤري Motorized Varifocal)" : ""}`);
    if (isColorVu) specs.push("تقنية ColorVu للتصوير الملون عالي الوضوح على مدار الساعة");
    if (isHybridLight) specs.push("إضاءة هجينة ذكية Smart Hybrid Light");
    if (isAcuSense) specs.push("تقنية الذكاء الاصطناعي AcuSense لتصنيف البشر والمركبات");
    if (hasMic) specs.push("ميكروفون مدمج لتسجيل الصوت عبر الشبكة");
    if (hasStrobeAlert) specs.push("إنذار صوتي وضوئي نشط (Strobe Light & Audio Warning)");
    specs.push("دعم التغذية عبر الشبكة PoE وضغط الفيديو H.265+");

    shortName = isThermal
      ? `كاميرا مراقبة حرارية IP احترافية — Thermal & Optical Network Camera`
      : `${shapeAr} ${resAr}${isColorVu ? " ColorVu" : ""}${isHybridLight ? " إضاءة ذكية" : ""}${hasMic ? " بالصوت" : ""} — ${resEn} ${shapeEn}`;
    description = `${shapeAr} من ${brand.name} موديل ${rawTitle} بدقة ${resAr}${lens ? ` وعدسة ${lens}` : ""}، تدعم تقنية PoE وضغط H.265+ لمراقبة شبكية عالية الدقة.`;
    keywords.push("كاميرا IP", "Network Camera", resAr, shapeAr);
  }

  // 4. Hikvision / HiLook PTZ IP Cameras (DS-2DE*, DS-2SE*, DS-2DF*, PTZ-*)
  else if (/^(?:DS-2DE|DS-2SE|DS-2DF|PTZ-)/i.test(up)) {
    mainCategoryId = "cctv";
    categoryId = "cctv-ip";
    const isTandemVu = /^DS-2SE/i.test(up);
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    specs.push(`النوع: ${isTandemVu ? "كاميرا PTZ مزدوجة العدسة TandemVu IP" : "كاميرا مراقبة متحركة شبكية PTZ IP Speed Dome"}`);
    specs.push("تقريب بصري فائق وزاوية دوران 360° مع تتبع ذكي");
    specs.push("تقنية AcuSense وDarkFighter للرؤية الليلية المتقدمة");
    shortName = isTandemVu
      ? `كاميرا متحركة PTZ مزدوجة العدسة TandemVu IP — تغطية بانورامية وزووم بصري`
      : `كاميرا مراقبة متحركة شبكية PTZ IP — تقريب بصري وتتبع ذكي AcuSense`;
    description = `كاميرا مراقبة متحركة شبكية PTZ من ${brand.name} موديل ${rawTitle} لتأمين المواقع الحيوية والمساحات المفتوحة بدقة فائقة.`;
    keywords.push("PTZ IP", "كاميرا متحركة", "TandemVu", "Speed Dome");
  }

  // 5. Hikvision Wi-Fi Cameras (DS-2CV*)
  else if (/^DS-2CV/i.test(up)) {
    mainCategoryId = "cctv";
    categoryId = "cctv-wifi";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    specs.push("النوع: كاميرا مراقبة لاسلكية Wi-Fi بصوت ثنائي الاتجاه");
    specs.push("متابعة مباشرة عبر تطبيق Hik-Connect وتسجيل على كارت ميموري أو NVR");
    shortName = `كاميرا مراقبة واي فاي ذكية بالصوت — Wi-Fi Network Camera`;
    description = `كاميرا مراقبة لاسلكية Wi-Fi من ${brand.name} موديل ${rawTitle} بصوت ثنائي الاتجاه ومتابعة فورية عبر الهاتف.`;
    keywords.push("كاميرا واي فاي", "Wi-Fi Camera");
  }

  // 6. DVR & NVR Recorders (iDS-71/72/73/77/96, DS-71/72/73/76/77/96, DS-E0*, DVR-*, NVR-*, Ezviz NVR*)
  else if (/^(?:I?DS-(?:71|72|73|76|77|96|E0)|DVR-|NVR-|EZVIZ NVR)/i.test(up)) {
    mainCategoryId = "cctv";
    categoryId = "cctv-recorders";

    const isNvr = /NI|NXI|^NVR|EZVIZ NVR/i.test(up);
    const isEdvr = /^DS-E0/i.test(up);
    const isAcuSense = /^IDS|NXI/i.test(up);
    const hasPoe = /\/\d+P\b/i.test(up);

    let ch = "4";
    const chMatch = up.match(/(?:71|72|73|76|77|96|E0|DVR-1|NVR-[12])(\d{2})/i) || up.match(/\((\d+)W\)/i);
    if (chMatch) ch = String( parseInt(chMatch[1], 10) );

    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    specs.push(`النوع: ${isNvr ? "جهاز تسجيل شبكي NVR" : "جهاز تسجيل رقمي DVR"}${isEdvr ? " مزود بوحدة تخزين eSSD مدمجة" : ""}`);
    specs.push(`عدد القنوات: ${ch} قناة (${ch}-ch)`);
    if (hasPoe) specs.push("مزود بمنافذ PoE مدمجة لتشغيل الكاميرات مباشرة");
    if (isAcuSense) specs.push("تقنية الذكاء الاصطناعي AcuSense للتعرف الذكي وتقليل الإنذارات الكاذبة");
    specs.push("ضغط فيديو متقدم H.265 Pro+ وربط كامل بتطبيق الموبايل");

    shortName = `${isNvr ? "جهاز تسجيل شبكي NVR" : "جهاز تسجيل كاميرات DVR"} ${ch} قناة${hasPoe ? " بمنافذ PoE" : ""}${isAcuSense ? " ذكاء اصطناعي AcuSense" : ""}${isEdvr ? " (شامل هارد eSSD مدمج)" : ""}`;
    description = `${shortName} من ${brand.name} موديل ${rawTitle}، يدعم المشاهدة عن بُعد عبر الهاتف والتسجيل المستمر بأعلى كفاءة.`;
    keywords.push(isNvr ? "NVR" : "DVR", "جهاز تسجيل", `${ch} قناة`);
  }

  // 7. Surveillance Hard Drives (WD Purple)
  else if (/^WD\b/i.test(up)) {
    mainCategoryId = "cctv";
    categoryId = "cctv-storage";
    specs.push("الماركة: Western Digital Purple");
    specs.push(`الموديل: ${rawTitle}`);
    specs.push("مخصص للعمل المتواصل 24/7 في أنظمة كاميرات المراقبة DVR وNVR");
    specs.push("تقنية AllFrame لمنع فقدان الإطارات وضمان معتمد لمدة 3 سنوات");
    shortName = `هارد ديسك ويسترن ديجيتال بيربل مخصص لكاميرات المراقبة 24/7 — ${rawTitle}`;
    description = `قرص صلب Western Digital Purple موديل ${rawTitle} مصمم خصيصاً لأجهزة تسجيل كاميرات المراقبة للعمل المتواصل على مدار الساعة.`;
    keywords.push("هارد", "WD Purple", "تخزين كاميرات");
  }

  // 8. Network Switches (DS-3E*, DS-3T*, DS-XS*, HK-SFP*, EXTENDER*)
  else if (/^(?:DS-3E|DS-3T|DS-XS|HK-SFP|EXTENDER)/i.test(up)) {
    mainCategoryId = "networks";
    categoryId = "net-switches";
    const isPoe = /P\b|P-|POE/i.test(up);
    const portMatch = up.match(/3[ET]\d{2}(\d{2})/i) || up.match(/XS(\d{2})/i);
    const ports = portMatch ? parseInt(portMatch[1], 10) : null;

    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    if (/^HK-SFP/i.test(up)) {
      specs.push("النوع: وحدة فايبر SFP Optical Transceiver Module");
      shortName = `وحدة ربط فايبر أوبتيك SFP بسرعة 1.25G — ${rawTitle}`;
    } else if (/^EXTENDER/i.test(up)) {
      specs.push("النوع: مقوي وممدد إشارة PoE عبر الشبكة");
      shortName = `ممدد إشارة وطاقة PoE للكاميرات والشبكات — ${rawTitle}`;
    } else {
      specs.push(`النوع: سويتش شبكات ${isPoe ? "يدعم الطاقة عبر الإيثرنت PoE" : "احترافي"}`);
      if (ports) specs.push(`عدد المنافذ: ${ports} منفذ`);
      if (isPoe) specs.push("يدعم التمديد لمسافات طويلة حتى 250-300 متر للكاميرات");
      shortName = `سويتش شبكات ${ports ? `${ports} منفذ ` : ""}${isPoe ? "PoE لكاميرات المراقبة والشبكات" : "جيجابت احترافي"}`;
    }
    description = `${shortName} من ${brand.name} موديل ${rawTitle} لتوصيل وتشغيل أنظمة الشبكات وكاميرات IP بكفاءة واستقرار عالٍ.`;
    keywords.push("سويتش", "PoE Switch", "شبكات");
  }

  // 9. Wireless Access Points, Routers, Extenders & USB Wi-Fi (DS-3WAP*, DS-3WR*, DS-3WG*)
  else if (/^(?:DS-3WAP|DS-3WR|DS-3WG)/i.test(up)) {
    mainCategoryId = "networks";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    if (/^DS-3WAP/i.test(up)) {
      categoryId = "net-access-point";
      specs.push("النوع: أكسيس بوينت لاسلكي احترافي لتغطية الواي فاي");
      shortName = `أكسيس بوينت واي فاي احترافي للتغطية اللاسلكية الموسعة — Wireless Access Point`;
    } else if (/^DS-3WRE/i.test(up)) {
      categoryId = "net-extenders";
      specs.push("النوع: مقوي وموسع نطاق شبكة الواي فاي Wi-Fi Range Extender");
      shortName = `مقوي إشارة وموسع نطاق واي فاي — Wi-Fi Range Extender`;
    } else if (/^DS-3WRU/i.test(up)) {
      categoryId = "net-adapters";
      specs.push("النوع: محول استقبال واي فاي USB لاسلكي");
      shortName = `أدابتر ومستقبل واي فاي USB فائق السرعة — USB Wireless Adapter`;
    } else {
      categoryId = "net-routers";
      specs.push("النوع: راوتر واي فاي وبوابة شبكات عالية السرعة");
      shortName = `راوتر واي فاي ثنائي النطاق عالي السرعة — Wireless Router`;
    }
    description = `${shortName} من ${brand.name} موديل ${rawTitle} لتغطية لاسلكية قوية ومستقرة للمنازل والشركات.`;
    keywords.push("واي فاي", "راوتر", "أكسيس بوينت", "شبكات");
  }

  // 10. Network Cables, Patch Cords, Patch Panels, Keystones (DS-1LN*, DS-1NP*, DS-1CP*, DS-1CM*, DS-1CK*, DS-1M*, DS-1FPA*)
  else if (/^(?:DS-1LN|DS-1NP|DS-1CP|DS-1CM|DS-1CK|DS-1M|DS-1FPA)/i.test(up)) {
    mainCategoryId = "networks";
    categoryId = "net-cables";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    if (/^DS-1LN/i.test(up)) {
      specs.push("النوع: كابل شبكة Cat6 UTP لتوصيل الشبكات وكاميرات IP");
      shortName = `كابل شبكة Cat6 معتمد للإنترنت وكاميرات المراقبة — Network Cable`;
    } else if (/^DS-1NP/i.test(up)) {
      specs.push("النوع: باتش كورد شبكة Cat6 جاهز بالمقابس RJ45");
      shortName = `كابل باتش كورد شبكة Cat6 أصلي — RJ45 Patch Cord`;
    } else if (/^DS-1CP|^DS-1CM/i.test(up)) {
      specs.push("النوع: باتش بانل ومنظم كابلات كبائن الشبكات 24 منفذ");
      shortName = `باتش بانل ومنظم كابلات راك شبكات 24 منفذ — 24-Port Patch Panel`;
    } else {
      specs.push("النوع: وحدات توصيل ومقابس شبكات Keystone / RJ45 / Faceplate");
      shortName = `وحدة توصيل ومقبس شبكات Cat6 معتمد — Network Accessory`;
    }
    description = `${shortName} من ${brand.name} موديل ${rawTitle} لتأسيس بنية تحتية احترافية للشبكات والاتصالات.`;
    keywords.push("كابل شبكة", "Cat6", "Patch Cord", "Patch Panel");
  }

  // 11. Intercom Systems (DS-KIS*, DS-KH*, DS-KV*, DS-KD*, DS-KB*, DS-KS*, DS-KP*, DS-KAD*, DS-KABV*, DS-KABD*, DS-KABP*)
  else if (/^(?:DS-KIS|DS-KH|DS-KV|DS-KD|DS-KB|DS-KS|DS-KP|DS-KAD|DS-KAB[VDP])/i.test(up)) {
    mainCategoryId = "intercom";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);

    if (/AUDIO ONLY|^DS-KS|^DS-KP|^DS-KD3003/i.test(up)) {
      categoryId = "intercom-audio";
      specs.push("النوع: جهاز وهاتف إنتركم صوتي واتصال داخلي SIP / Audio Intercom");
      shortName = `وحدة إنتركم واتصال صوتي داخلي احترافي — Audio / SIP Intercom`;
    } else if (/^DS-KD-|^DS-KAB[VDP]|^DS-KAD|FRAME|SURFACE|FLUSH/i.test(up)) {
      categoryId = "intercom-accessories";
      specs.push("النوع: ملحقات ووحدات توسعة وإطارات تركيب أنظمة الإنتركم");
      shortName = `وحدة وملحق تجميع إنتركم معياري — Modular Intercom Accessory`;
    } else if (/^DS-KIS/i.test(up)) {
      categoryId = "intercom-video";
      specs.push("النوع: طقم إنتركم مرئي متكامل (شاشة داخلية + كاميرا باب خارجية)");
      specs.push("رؤية واضحة للزائر، تخاطب صوتي ومرئي، وفتح الباب عن بُعد");
      shortName = `طقم إنتركم فيديو متكامل للشقق والفيلات — Video Intercom Kit`;
    } else if (/^DS-KH/i.test(up)) {
      categoryId = "intercom-video";
      specs.push("النوع: شاشة إنتركم فيديو داخلية تعمل باللمس وتدعم الربط بالهاتف");
      shortName = `شاشة إنتركم فيديو داخلية ذكية — Indoor Video Intercom Station`;
    } else {
      categoryId = "intercom-video";
      specs.push("النوع: اللوحة الخارجية لكاميرا وجرس الباب الذكي للإنتركم المرئي");
      shortName = `كاميرا ولوحة باب خارجية للإنتركم المرئي — Villa / Modular Door Station`;
    }
    description = `${shortName} من ${brand.name} موديل ${rawTitle} لتأمين المداخل والتواصل مع الزوار بالصوت والصورة.`;
    keywords.push("إنتركم", "انتركم فيديو", "انتركم صوتي", "Intercom");
  }

  // 12. Access Control, Time Attendance, Locks, Turnstiles & Gates (DS-K1*, DS-K2*, DS-K3*, DS-K4*, DS-K5*, DS-K7*, DS-KAB6*, DS-KAW*, DS-KAS*, DS-KI8*, DS-TCG*, DS-TMG*, FM11*)
  else if (/^(?:DS-K[123457]|DS-KAB6|DS-KAW|DS-KAS|DS-KI8|DS-TCG|DS-TMG|FM11)/i.test(up)) {
    mainCategoryId = "access-control";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);

    if (/^DS-K4SL/i.test(up)) {
      categoryId = "access-smartlock";
      specs.push("النوع: قفل باب ذكي إلكتروني");
      shortName = `قفل باب ذكي إلكتروني متعدد طرق الفتح — Smart Door Lock`;
    } else if (/^DS-K50/i.test(up)) {
      categoryId = "access-screens";
      specs.push("النوع: شاشة ومنصة تسجيل وإدارة الزوار الذكية");
      shortName = `منصة وشاشة إدارة وتسجيل الزوار — Interactive Visitor Terminal`;
    } else if (/^DS-K1T|^DS-K1A/i.test(up)) {
      categoryId = "access-ip-surveillance";
      const hasFace = /320|321|341|342|343|344|671|673|680|681/i.test(up);
      specs.push(`النوع: جهاز بصمة وحضور وانصراف وتحكم في الأبواب${hasFace ? " ببصمة الوجه والإصبع والكارت" : " بالبصمة والكارت"}`);
      shortName = hasFace
        ? `جهاز حضور وانصراف وأكسيس كنترول ببصمة الوجه والإصبع — Face Recognition Terminal`
        : `جهاز بصمة وحضور وانصراف وتحكم في الدخول — Access Control & Time Attendance`;
    } else if (/^DS-K2/i.test(up)) {
      categoryId = "access-ip-surveillance";
      specs.push("النوع: لوحة تحكم مركزية في الأبواب والمصاعد Access Controller");
      shortName = `لوحة تحكم مركزية للأبواب والأكسيس كنترول — Multi-Door Access Controller`;
    } else if (/^DS-K3|^DS-TCG|^DS-TMG/i.test(up)) {
      categoryId = "access-ip-surveillance";
      specs.push("النوع: بوابات مرور إلكترونية للأفراد والمركبات وكاميرات قراءة اللوحات ANPR");
      shortName = `بوابة إلكترونية ونظام التحكم في المداخل والمواقف — Turnstile & Barrier System`;
    } else {
      categoryId = "access-accessories";
      if (/^DS-K4H|^DS-K4T|^DS-K4E|^DS-K4G/i.test(up)) {
        specs.push("النوع: قفل مغناطيسي إلكتروني وحوامل تثبيت للأبواب (Magnetic / Bolt Lock)");
        shortName = `قفل باب مغناطيسي إلكتروني وحامل تثبيت للأكسيس كنترول — Magnetic / Electric Lock`;
      } else if (/^DS-K4DC/i.test(up)) {
        specs.push("النوع: دفاش باب هيدروليكي أوتوماتيكي Door Closer");
        shortName = `دفاش باب هيدروليكي احترافي للأبواب — Hydraulic Door Closer`;
      } else if (/^DS-K7P/i.test(up)) {
        specs.push("النوع: زر خروج ومفتاح طوارئ لأنظمة التحكم في الأبواب Exit Button");
        shortName = `زر خروج للأبواب وأنظمة الأكسيس كنترول — Door Exit Button`;
      } else {
        specs.push("النوع: قارئ كروت وبصمة وملحقات أنظمة الأكسيس كنترول");
        shortName = `قارئ كروت وملحقات أنظمة التحكم في الدخول — Access Control Reader & Accessory`;
      }
    }
    description = `${shortName} من ${brand.name} موديل ${rawTitle} لإدارة صلاحيات الدخول وتأمين الأبواب والمنشآت.`;
    keywords.push("أكسيس كنترول", "بصمة", "حضور وانصراف", "Access Control");
  }

  // 13. Audio Systems (DS-Q*, DS-2FP*)
  else if (/^(?:DS-Q|DS-2FP)/i.test(up)) {
    mainCategoryId = "audio";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);

    if (/^DS-QAZ1A|^DS-QAE0A|^DS-QAE1A|^DS-QAE1KA/i.test(up)) {
      categoryId = "audio-amplifiers";
      specs.push("النوع: جهاز مكبر ومضخم صوت مركزي للإذاعة الداخلية Amplifier");
      shortName = `مضخم ومكبر صوت احترافي لأنظمة الإذاعة الداخلية — Audio Power Amplifier`;
    } else if (/^DS-QAZ1MP|^DS-QAE0MG|^DS-QAZ1C|^DS-2FP/i.test(up)) {
      categoryId = "audio-mics";
      specs.push("النوع: ميكروفون نداء وإذاعة داخلية / التقاط صوتي عالي النقاء");
      shortName = `ميكروفون نداء والتقاط صوتي احترافي — Paging & Audio Microphone`;
    } else {
      categoryId = "audio-speakers";
      const isCeiling = /QAE02|QAZ12|QAZ02/i.test(up);
      const isColumn = /QAE04|QAZ13/i.test(up);
      const isHorn = /QAE06|QAZ16/i.test(up);
      const spkType = isCeiling ? "سماعة سقفية" : isColumn ? "سماعة عمودية حائطية" : isHorn ? "سماعة هورن خارجية" : "سماعة جدارية";
      specs.push(`النوع: ${spkType} لأنظمة الصوتيات والإذاعة الداخلية`);
      shortName = `${spkType} عالية النقاء للإذاعة الداخلية والنداء الصوتي — Professional Speaker`;
    }
    description = `${shortName} من ${brand.name} موديل ${rawTitle} لتوزيع صوتي نقي ومتوازن في الشركات والمنشآت والمساجد.`;
    keywords.push("صوتيات", "سماعات", "مكبر صوت", "إذاعة داخلية");
  }

  // 14. Screens & Interactive Displays (DS-D*)
  else if (/^DS-D/i.test(up)) {
    mainCategoryId = "screens";
    categoryId = "screens-displays";
    const isInteractive = /^DS-D5[ABC]/i.test(up);
    const inchMatch = up.match(/D5[0ABC](\d{2})/i);
    const inches = inchMatch ? `${inchMatch[1]} بوصة` : "";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    specs.push(`النوع: ${isInteractive ? `شاشة تفاعلية ذكية 4K ${inches}` : `شاشة عرض ومراقبة احترافية 24/7 ${inches}`}`);
    shortName = isInteractive
      ? `شاشة تفاعلية ذكية 4K ${inches} للاجتماعات والتعليم — Interactive Flat Panel`
      : `شاشة عرض ومراقبة تخصصية ${inches} للعمل المتواصل 24/7 — Surveillance Monitor`;
    description = `${shortName} من ${brand.name} موديل ${rawTitle} بدقة فائقة وموثوقية عالية لغرف التحكم والشركات.`;
    keywords.push("شاشة مراقبة", "شاشة عرض", "شاشة تفاعلية");
  }

  // 15. EZVIZ Smart Home, Cameras, Smart Locks & Video Doorbells
  else if (brand.id === BRAND_IDS.ezviz) {
    specs.push("الماركة: EZVIZ");
    specs.push(`الموديل: ${rawTitle}`);
    if (/DL0|DL5/i.test(up)) {
      mainCategoryId = "access-control";
      categoryId = "access-smartlock";
      specs.push("النوع: قفل باب ذكي ببصمة الإصبع والكود السري والكارت وتطبيق الموبايل");
      shortName = `قفل باب ذكي إيزفيز بالبصمة والتطبيق — EZVIZ Smart Door Lock`;
    } else if (/HP[457]|DP2|EP3|DB2|SD7/i.test(up)) {
      mainCategoryId = "intercom";
      categoryId = "intercom-video";
      specs.push("النوع: إنتركم فيديو ذكي / عين سحرية ديجيتال بشاشة ملونة وربط بالموبايل");
      shortName = `إنتركم فيديو وعين سحرية ذكية بالواي فاي والشاشة — EZVIZ Smart Video Doorphone`;
    } else if (/^EZVIZ T|^EZVIZ CS-|^EZVIZ A1/i.test(up)) {
      mainCategoryId = "general-electronics";
      categoryId = "general-electronics";
      specs.push("النوع: حساسات وأجهزة إنذار المنزل الذكي اللاسلكية EZVIZ Smart Sensor");
      shortName = `حساس وجهاز إنذار ذكي لاسلكي للمنزل الذكي — EZVIZ Smart Home Sensor`;
    } else {
      mainCategoryId = "cctv";
      categoryId = "cctv-wifi";
      specs.push("النوع: كاميرا مراقبة واي فاي ذكية متحركة/ثابتة مع تتبع ذكي وصوت ثنائي");
      shortName = `كاميرا مراقبة ذكية واي فاي من إيزفيز — EZVIZ Smart Wi-Fi Camera`;
    }
    description = `${shortName} موديل ${rawTitle} مع تحكم كامل وإشعارات فورية عبر تطبيق EZVIZ على الهاتف.`;
    keywords.push("EZVIZ", "إيزفيز", "كاميرا واي فاي", "منزل ذكي");
  }

  // 16. UPS & Alarm Detectors (DS-UPS*, DS-PD*)
  else if (/^(?:DS-UPS|DS-PD)/i.test(up)) {
    mainCategoryId = "general-electronics";
    categoryId = "general-electronics";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    if (/^DS-UPS/i.test(up)) {
      specs.push("النوع: جهاز مانع انقطاع التيار الكهربائي UPS لحماية الكاميرات والشبكات");
      shortName = `جهاز UPS مانع انقطاع التيار الكهربائي لأنظمة المراقبة والشبكات — Uninterruptible Power Supply`;
    } else {
      specs.push("النوع: حساس كشف الحركة والإنذار الأمني PIR Motion Detector");
      shortName = `حساس كشف الحركة لأنظمة الإنذار والحماية — Security Motion Detector`;
    }
    description = `${shortName} من ${brand.name} موديل ${rawTitle} لضمان استمرارية التشغيل وتأمين المواقع.`;
    keywords.push("UPS", "باور", "إنذار");
  }

  // 17. CCTV Brackets, Baluns, Cables & Power Adapters (DS-12*, DS-14*, DS-16*, DS-1H*, DS-2FA*, Adapter*, Cable*, Hikvision AC*)
  else {
    mainCategoryId = "cctv";
    specs.push(`الماركة: ${brand.name}`);
    specs.push(`الموديل: ${rawTitle}`);
    if (/^DS-1LH|^CABLE|POWER CABLE/i.test(up)) {
      categoryId = "cctv-cables";
      specs.push("النوع: كابل توصيل وإمداد طاقة وإشارة لأنظمة كاميرات المراقبة");
      shortName = `كابل كاميرات مراقبة معتمد — CCTV Coaxial & Power Cable`;
    } else if (/^DS-1H/i.test(up)) {
      categoryId = "cctv-accessories";
      specs.push("النوع: فيديو بالون لنقل إشارة الكاميرات عبر كابلات الشبكة Video Balun");
      shortName = `فيديو بالون لنقل إشارة كاميرات المراقبة — Passive Video Balun`;
    } else if (/^DS-2FA|^ADAPTER/i.test(up)) {
      categoryId = "cctv-accessories";
      specs.push("النوع: مزود طاقة وأدابتر أصلي لكاميرات المراقبة Power Supply");
      shortName = `مزود طاقة وأدابتر أصلي لكاميرات المراقبة — Regulated Power Supply`;
    } else if (/^DS-U18/i.test(up)) {
      categoryId = "cctv-accessories";
      specs.push("النوع: كاميرا ويب USB بدقة 4K للاجتماعات والبث المرئي");
      shortName = `كاميرا ويب احترافية بدقة 4K USB — 4K USB Webcam`;
    } else {
      categoryId = "cctv-accessories";
      specs.push("النوع: حامل تثبيت وعلبة تجميع أصلية لكاميرات المراقبة Mounting Bracket");
      shortName = `حامل وعلبة تثبيت أصلية لكاميرات المراقبة — Camera Mounting Bracket`;
    }
    description = `${shortName} من ${brand.name} موديل ${rawTitle} لتركيب وتوصيل أنظمة المراقبة بمعايير هندسية احترافية.`;
    keywords.push("اكسسوارات كاميرات", "حامل كاميرا", "باور سبلاي");
  }

  return {
    title: rawTitle,
    brandId: brand.id,
    brandName: brand.name,
    mainCategoryId,
    categoryId,
    shortName,
    description,
    specs,
    keywords
  };
}

// Build lookup map of existing store products to prevent duplicates and preserve existing data
const existingByModelKey = new Map();
const existingBySupplierId = new Map();
const usedIds = new Set();
const usedSlugs = new Set();

for (const prod of store.products) {
  usedIds.add(prod.id);
  if (prod.slug) usedSlugs.add(prod.slug);
  const key1 = normalizeModelKey(prod.name);
  if (key1) existingByModelKey.set(key1, prod);
  // Also extract parenthetical model code if present, e.g. "Hikvision DS-7616NXI-K2 (16-Ch...)"
  const parenStripped = prod.name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const key2 = normalizeModelKey(parenStripped);
  if (key2) existingByModelKey.set(key2, prod);
  if (prod.supplierMeta && prod.supplierMeta.supplierId) {
    existingBySupplierId.set(Number(prod.supplierMeta.supplierId), prod);
  }
}

let matchedExistingCount = 0;
let newImportedCount = 0;
let duplicatesSkipped = 0;
const categoryDistribution = {};
const seenRawModelKeys = new Set();

for (const rawItem of rawCatalog) {
  const classified = classifyAndDescribeProduct(rawItem);
  const normKey = normalizeModelKey(classified.title);
  const baseKey = normalizeModelKey(classified.title.replace(/\s*\([^)]*\)\s*/g, " ").trim());

  const supplierMeta = {
    supplierName: "FastEgy",
    supplierId: rawItem.id,
    supplierSku: classified.title,
    supplierPrice: rawItem.p,
    supplierCurrency: "EGP",
    supplierUrl: `https://www.fastegy.net/ar/shop/${rawItem.s}`,
    supplierImage: `https://www.fastegy.net/web/image/product.template/${rawItem.id}/image_512`,
    supplierImageHiRes: `https://www.fastegy.net/web/image/product.template/${rawItem.id}/image_1024`,
    fetchedAt: NOW
  };

  // Check if matches an existing Watch Point product
  const existingMatch =
    existingBySupplierId.get(Number(rawItem.id)) ||
    existingByModelKey.get(normKey) ||
    (baseKey.length >= 7 ? existingByModelKey.get(baseKey) : null);

  if (existingMatch) {
    // Preserve existing ERP/Admin fields (price, name, shortName, image, specs, featured)
    // Only attach private supplierMeta and fill missing fields if empty
    if (!existingMatch.supplierMeta) {
      matchedExistingCount++;
    } else {
      duplicatesSkipped++;
    }
    existingMatch.supplierMeta = supplierMeta;
    if (!existingMatch.shortName) existingMatch.shortName = classified.shortName;
    if (!existingMatch.description) existingMatch.description = classified.description;
    if (!existingMatch.specs || !existingMatch.specs.length) existingMatch.specs = classified.specs;
    const catKey = `${existingMatch.mainCategoryId}/${existingMatch.categoryId}`;
    categoryDistribution[catKey] = (categoryDistribution[catKey] || 0) + 1;
    continue;
  }

  // Check if duplicate within raw feed
  if (seenRawModelKeys.has(normKey)) {
    duplicatesSkipped++;
    continue;
  }
  seenRawModelKeys.add(normKey);

  // Create new product record
  const cleanSlugBase = String(rawItem.s || classified.title)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  let slug = cleanSlugBase || `item-${rawItem.id}`;
  if (usedSlugs.has(slug)) {
    slug = `${slug}-${rawItem.id}`;
  }
  usedSlugs.add(slug);

  const id = `prod-fe-${rawItem.id}`;
  usedIds.add(id);

  const officialImgUrl = `https://www.fastegy.net/web/image/product.template/${rawItem.id}/image_512`;

  const newProduct = {
    id,
    slug,
    name: classified.title,
    shortName: classified.shortName,
    mainCategoryId: classified.mainCategoryId,
    categoryId: classified.categoryId,
    brandId: classified.brandId,
    price: supplierMeta.supplierPrice,
    priceCurrency: "EGP",
    availability: supplierMeta.supplierPrice ? "available" : "quote",
    featured: false,
    demo: false,
    image: officialImgUrl,
    imageAlt: `${classified.title} — ${classified.shortName}`,
    description: classified.description,
    specs: classified.specs,
    keywords: classified.keywords,
    supplierMeta
  };

  store.products.push(newProduct);
  existingBySupplierId.set(Number(rawItem.id), newProduct);
  newImportedCount++;

  const catKey = `${classified.mainCategoryId}/${classified.categoryId}`;
  categoryDistribution[catKey] = (categoryDistribution[catKey] || 0) + 1;
}

store.updatedAt = NOW;
fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");

const report = {
  timestamp: NOW,
  supplier: "https://www.fastegy.net/ar/store",
  totalDiscovered: rawCatalog.length,
  newProductsImported: newImportedCount,
  existingProductsMatched: matchedExistingCount,
  duplicatesSkipped,
  totalProductsInStore: store.products.length,
  categoryDistribution
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
console.log("Import Summary:", JSON.stringify(report, null, 2));
