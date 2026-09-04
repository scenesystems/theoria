// Google Analytics 4 bootstrap. The Worker adds this script to the shell only
// when GA_MEASUREMENT_ID is configured and the request is on the canonical
// hostname (app/server/analytics.ts); the measurement ID arrives as a data
// attribute so this file stays static and same-origin under the CSP.
//
// Consent Mode v2 defaults, scoped by region as Google documents
// (developers.google.com/tag-platform/security/guides/consent):
//
// - Advertising storage is denied everywhere. The site runs no ads and never
//   needs ad cookies or personalization.
// - Analytics storage is granted everywhere except the EEA, the United
//   Kingdom, and Switzerland, where ePrivacy rules require consent before an
//   analytics cookie is set. Visitors there send cookieless pings only, which
//   GA4 uses for modeling rather than reporting; Cloudflare Web Analytics
//   still counts them. Everywhere else GA4 reports observed pageviews and
//   users without a consent UI.
//
// The regional command must precede the general one only for readability:
// Google applies the most specific matching region regardless of order.
// Page views after in-app navigation come from GA4 enhanced measurement
// (browser history events).
(function () {
  var measurementId = document.currentScript.dataset.measurementId;
  var consentRequiredRegions = [
    // European Economic Area: the 27 EU member states plus Iceland,
    // Liechtenstein, and Norway.
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE", "IS", "LI", "NO",
    // United Kingdom (UK GDPR and PECR) and Switzerland (revised FADP).
    "GB", "CH"
  ];
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    region: consentRequiredRegions
  });
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted"
  });
  gtag("js", new Date());
  gtag("config", measurementId);
})();
