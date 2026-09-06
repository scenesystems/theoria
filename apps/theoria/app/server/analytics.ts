import type { HttpServerRequest } from "@effect/platform"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { requestIsCanonical } from "./canonical-host.js"
import { Analytics, type AnalyticsSettings, disabledAnalytics } from "./config/analytics.js"

/**
 * Analytics tags for the HTML shell.
 *
 * Google Analytics 4 loads `gtag.js` and a same-origin bootstrap
 * (`public/analytics/gtag-init.js`) that sets region-scoped Consent Mode v2
 * defaults: analytics storage granted except in the EEA, UK, and Switzerland,
 * advertising storage denied everywhere.
 * Cloudflare Web Analytics loads its beacon, which is cookieless by design.
 * Neither snippet is inline, so the CSP needs no hashes or nonces.
 *
 * Tags are emitted only for the canonical hostname: staging and pull-request
 * previews run the same Worker and must not report traffic.
 */

export const googleTagManagerHost = "https://www.googletagmanager.com"
export const cloudflareInsightsScriptHost = "https://static.cloudflareinsights.com"
export const cloudflareInsightsBeaconHost = "https://cloudflareinsights.com"

const googleTags = (measurementId: string): ReadonlyArray<string> => [
  `<script async src="${googleTagManagerHost}/gtag/js?id=${measurementId}"></script>`,
  `<script defer src="/analytics/gtag-init.js" data-measurement-id="${measurementId}"></script>`
]

const cloudflareTags = (token: string): ReadonlyArray<string> => [
  `<script defer src="${cloudflareInsightsScriptHost}/beacon.min.js" data-cf-beacon='{"token":"${token}"}'></script>`
]

export const analyticsTags = (settings: AnalyticsSettings): ReadonlyArray<string> => [
  ...Option.match(settings.googleMeasurementId, { onNone: () => [], onSome: googleTags }),
  ...Option.match(settings.cloudflareBeaconToken, { onNone: () => [], onSome: cloudflareTags })
]

/** Inserts the configured tags at the end of `<head>`. */
export const injectAnalytics = (html: string, settings: AnalyticsSettings): string => {
  const tags = analyticsTags(settings)
  return Arr.isEmptyReadonlyArray(tags)
    ? html
    : html.replace("</head>", () => `  ${Arr.join(tags, "\n    ")}\n  </head>`)
}

/** The analytics settings for the current request: configured values on the canonical host, nothing elsewhere. */
export const requestAnalytics: Effect.Effect<
  AnalyticsSettings,
  never,
  Analytics | HttpServerRequest.HttpServerRequest
> = Effect.gen(function*() {
  const canonical = yield* requestIsCanonical
  const settings = yield* Analytics

  return canonical ? settings : disabledAnalytics
})
