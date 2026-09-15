import type { HttpServerRequest } from "@effect/platform"
import { Boolean as Bool, Effect, Option } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

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

export const analyticsTags = (settings: AnalyticsSettings): ReadonlyArray<string> =>
  Arr.appendAll(
    Option.match(settings.googleMeasurementId, { onNone: () => Arr.empty<string>(), onSome: googleTags }),
    Option.match(settings.cloudflareBeaconToken, { onNone: () => Arr.empty<string>(), onSome: cloudflareTags })
  )

/**
 * Inserts the configured tags at the end of `<head>`. The tags are spliced
 * in at the closing tag's position rather than through a replacement
 * pattern, so nothing in a token is read as a substitution.
 */
export const injectAnalytics = (html: string, settings: AnalyticsSettings): string =>
  Arr.match(analyticsTags(settings), {
    onEmpty: () => html,
    onNonEmpty: (tags) =>
      Option.match(Str.indexOf("</head>")(html), {
        onNone: () => html,
        onSome: (at) =>
          Str.concat(
            Str.concat(Str.slice(0, at)(html), `  ${Arr.join(tags, "\n    ")}\n  `),
            Str.slice(at)(html)
          )
      })
  })

/** The analytics settings for the current request: configured values on the canonical host, nothing elsewhere. */
export const requestAnalytics: Effect.Effect<
  AnalyticsSettings,
  never,
  Analytics | HttpServerRequest.HttpServerRequest
> = Effect.gen(function*() {
  const canonical = yield* requestIsCanonical
  const settings = yield* Analytics

  return Bool.match(canonical, { onTrue: () => settings, onFalse: () => disabledAnalytics })
})
