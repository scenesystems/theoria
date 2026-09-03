import { HttpMiddleware, HttpServerResponse } from "@effect/platform"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import {
  cloudflareInsightsBeaconHost,
  cloudflareInsightsScriptHost,
  googleTagManagerHost,
  requestAnalytics
} from "./analytics.js"
import type { AnalyticsSettings } from "./config/analytics.js"

/**
 * The Content Security Policy is strict by default and widens only for the
 * analytics providers configured for the request (see `analytics.ts`):
 * Google Analytics needs the tag loader, its collection endpoints, and pixel
 * fallbacks; Cloudflare Web Analytics needs its beacon script and endpoint.
 */

type Sources = {
  readonly script: ReadonlyArray<string>
  readonly connect: ReadonlyArray<string>
  readonly img: ReadonlyArray<string>
}

const none: Sources = { script: [], connect: [], img: [] }

const googleSources: Sources = {
  script: [googleTagManagerHost],
  connect: ["https://*.google-analytics.com", "https://*.analytics.google.com", googleTagManagerHost],
  img: ["https://*.google-analytics.com", googleTagManagerHost]
}

const cloudflareSources: Sources = {
  script: [cloudflareInsightsScriptHost],
  connect: [cloudflareInsightsBeaconHost],
  img: []
}

const analyticsSources = (settings: AnalyticsSettings): Sources => {
  const google = Option.isSome(settings.googleMeasurementId) ? googleSources : none
  const cloudflare = Option.isSome(settings.cloudflareBeaconToken) ? cloudflareSources : none
  return {
    script: [...google.script, ...cloudflare.script],
    connect: [...google.connect, ...cloudflare.connect],
    img: [...google.img, ...cloudflare.img]
  }
}

const directive = (name: string, sources: ReadonlyArray<string>): string => Arr.join([name, ...sources], " ")

export const contentSecurityPolicy = (settings: AnalyticsSettings): string => {
  const extra = analyticsSources(settings)
  return Arr.join([
    "default-src 'self'",
    "base-uri 'self'",
    directive("connect-src", ["'self'", ...extra.connect]),
    "font-src 'self' https://fonts.gstatic.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    directive("img-src", ["'self'", "data:", ...extra.img]),
    "object-src 'none'",
    // Shiki's Oniguruma grammar engine is WebAssembly; `wasm-unsafe-eval`
    // permits compiling it without permitting JavaScript `eval`.
    directive("script-src", ["'self'", "'wasm-unsafe-eval'", ...extra.script]),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "worker-src 'self'"
  ], "; ")
}

export const securityHeaders = HttpMiddleware.make((app) =>
  Effect.gen(function*() {
    const settings = yield* requestAnalytics
    const response = yield* app

    return HttpServerResponse.setHeaders(response, {
      "content-security-policy": contentSecurityPolicy(settings),
      "cross-origin-opener-policy": "same-origin",
      "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      "referrer-policy": "strict-origin-when-cross-origin",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY"
    })
  })
)
