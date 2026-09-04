// Google Analytics 4 bootstrap. The Worker adds this script to the shell only
// when GA_MEASUREMENT_ID is configured and the request is on the canonical
// hostname (app/server/analytics.ts); the measurement ID arrives as a data
// attribute so this file stays static and same-origin under the CSP.
//
// Consent Mode v2 defaults every storage type to denied: Google Analytics
// receives cookieless pings and stores nothing on the visitor's device until a
// consent UI calls gtag("consent", "update", ...). Page views after in-app
// navigation come from GA4 enhanced measurement (browser history events).
;(function() {
  var measurementId = document.currentScript.dataset.measurementId
  window.dataLayer = window.dataLayer || []
  function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag = gtag
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied"
  })
  gtag("js", new Date())
  gtag("config", measurementId)
})()
