// classify-source.js
// Drop-in traffic attribution classifier for the remarketing pipeline.
// Parses a landing URL + referrer and returns a structured verdict:
//   { source, network, partner, partner_id, placement, campaign, raw }
//
// Designed around the real chains seen in the trybinge.tv data:
//   ShopperMobi (Trackier) -> Impact.com (pxf.io) -> trybinge.tv
//   ...arriving with irclickid / irpid / sharedid / afsrc params.
//
// No dependencies. Safe on malformed URLs. Pure function.

// ---------------------------------------------------------------------------
// 1. Partner lookups — extend these as you identify more publishers.
// ---------------------------------------------------------------------------

// Impact.com publisher id (irpid) -> human-readable partner name.
// 4441119 is confirmed = ShopperMobi (from the live redirect trace).
// The others appear in the events data; fill them in as you identify them.
const IRPID_PARTNERS = {
  "4441119": "ShopperMobi",
  // "4253605": "TODO",
  // "10813":   "TODO",
  // "6247000": "TODO",
};

// utm_source / client-sent source values that mean "affiliate".
const KNOWN_AFFILIATE_UTM = new Set([
  "affiliate_john",
]);

// Search engines -> organic.
const SEARCH_HOSTS = [
  "google.", "bing.", "yahoo.", "duckduckgo.", "yandex.",
  "baidu.", "ecosia.", "brave.", "startpage.",
];

// External referrer hosts that are really affiliate/coupon/cashback traffic
// even when the URL params are missing (e.g. hop stripped the click id).
const AFFILIATE_REFERRER_HOSTS = [
  "fatcoupon.com", "studentbeans.com", "convertsocial.net",
  "gotrackier.com", "pxf.io", "impact.com",
];

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

function safeParse(u) {
  try { return new URL(u); } catch { return null; }
}

function getParams(u) {
  const parsed = safeParse(u);
  return parsed ? parsed.searchParams : new URLSearchParams();
}

function hostOf(u) {
  const parsed = safeParse(u);
  return parsed ? parsed.hostname.replace(/^www\./, "").toLowerCase() : null;
}

// sharedid frequently holds a URL-encoded URL (the true placement), e.g.
// "https%3A%2F%2Fwww.studentbeans.com" -> studentbeans.com.
// Sometimes it's a bare id ("534151"). Normalize both.
function normalizeSharedid(raw) {
  if (!raw) return null;
  let val = raw;
  try { val = decodeURIComponent(raw); } catch { /* keep raw */ }
  if (/^https?:\/\//i.test(val)) {
    const h = hostOf(val);
    if (h) return h;            // -> "studentbeans.com"
  }
  return val;                    // -> bare id like "534151"
}

// ---------------------------------------------------------------------------
// 3. Main classifier
// ---------------------------------------------------------------------------

/**
 * @param {Object} input
 * @param {string} [input.url]          full landing URL (with query string)
 * @param {string} [input.referrer]     document.referrer
 * @param {string} [input.utmMedium]    e.utm_medium
 * @param {string} [input.utmCampaign]  e.utm_campaign
 * @param {string} [input.clientSource] e.source sent by the client script
 * @returns {{source:string, network:string|null, partner:string|null,
 *            partner_id:string|null, placement:string|null,
 *            campaign:string|null, raw:Object}}
 */
export function classifyTraffic({
  url = "",
  referrer = "",
  utmMedium = "",
  utmCampaign = "",
  clientSource = "",
} = {}) {
  const p = getParams(url);
  const get = (k) => p.get(k) || null;

  const irclickid = get("irclickid");
  const irpid     = get("irpid");
  const sharedid  = get("sharedid");
  const afsrc     = get("afsrc");
  const campaignId = get("campaign_id");   // Trackier
  const pubId      = get("pub_id");        // Trackier
  const clickId    = get("click_id") || get("p1"); // Trackier click macro
  const utmSource  = get("utm_source") || clientSource || null;

  const refHost = hostOf(referrer);
  const placement = normalizeSharedid(sharedid);

  // --- Layer 1: Impact.com (irclickid is the definitive signal) ------------
  // Also catch irpid/afsrc even if irclickid was stripped on a later hop.
  if (irclickid || irpid || afsrc) {
    return {
      source: "affiliate",
      network: "impact.com",
      partner: irpid ? (IRPID_PARTNERS[irpid] || null) : null,
      partner_id: irpid || null,
      placement,                                  // true origin, e.g. studentbeans.com
      campaign: utmCampaign || null,
      raw: { irclickid, irpid, sharedid, afsrc },
    };
  }

  // --- Layer 2: Trackier (gotrackier) --------------------------------------
  const trackierRef = refHost && refHost.includes("gotrackier.");
  if (campaignId || pubId || trackierRef) {
    return {
      source: "affiliate",
      network: "trackier",
      partner: pubId || null,                     // Trackier pub_id
      partner_id: pubId || null,
      placement: placement || null,
      campaign: campaignId || utmCampaign || null,
      raw: { campaign_id: campaignId, pub_id: pubId, click_id: clickId },
    };
  }

  // --- Layer 3: explicit affiliate via UTM / client source -----------------
  if (
    (utmMedium && utmMedium.toLowerCase() === "affiliate") ||
    (utmSource && KNOWN_AFFILIATE_UTM.has(utmSource.toLowerCase()))
  ) {
    return {
      source: "affiliate",
      network: null,
      partner: utmSource || null,
      partner_id: null,
      placement: placement || null,
      campaign: utmCampaign || null,
      raw: { utm_source: utmSource, utm_medium: utmMedium },
    };
  }

  // --- Layer 4: other UTM-tagged traffic (paid / email / social / etc.) ----
  if (utmMedium) {
    const m = utmMedium.toLowerCase();
    let source = "referral";
    if (["cpc", "ppc", "paid", "paidsearch", "display"].includes(m)) source = "paid";
    else if (["email", "newsletter"].includes(m)) source = "email";
    else if (["social", "paid-social", "paid_social"].includes(m)) source = "social";
    else if (m === "organic") source = "organic";
    return {
      source,
      network: null,
      partner: utmSource || null,
      partner_id: null,
      placement: null,
      campaign: utmCampaign || null,
      raw: { utm_source: utmSource, utm_medium: utmMedium },
    };
  }

  // --- Layer 5: referrer-based fallback ------------------------------------
  if (refHost) {
    if (SEARCH_HOSTS.some((s) => refHost.includes(s))) {
      return blank("organic", { referrer: refHost });
    }
    if (AFFILIATE_REFERRER_HOSTS.some((h) => refHost.includes(h))) {
      return {
        source: "affiliate",
        network: refHost.includes("pxf.io") || refHost.includes("impact.com")
          ? "impact.com"
          : refHost.includes("gotrackier.") ? "trackier" : null,
        partner: null,
        partner_id: null,
        placement: refHost,
        campaign: null,
        raw: { referrer: refHost },
      };
    }
    // some other external site linked in
    return blank("referral", { referrer: refHost });
  }

  // --- Layer 6: nothing at all ---------------------------------------------
  return blank("direct", {});
}

function blank(source, raw) {
  return { source, network: null, partner: null, partner_id: null,
           placement: null, campaign: null, raw };
}

export { IRPID_PARTNERS };
