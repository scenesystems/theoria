import { describe, expect, it } from "@effect/vitest"
import { ConfigError, ConfigProvider, Effect, Layer, Option, Schema } from "effect"

import { analyticsTags, injectAnalytics } from "../../app/server/analytics.js"
import {
  analyticsConfig,
  type AnalyticsSettings,
  CloudflareBeaconToken,
  disabledAnalytics,
  GoogleMeasurementId
} from "../../app/server/config/analytics.js"
import { contentSecurityPolicy } from "../../app/server/security-headers.js"

const withEnvironment = (variables: Record<string, string>) =>
  Layer.setConfigProvider(ConfigProvider.fromJson(variables))

const measurementId = "G-ABC123XYZ"
const beaconToken = "0123456789abcdef0123456789abcdef"

describe("analytics configuration", () => {
  it.effect("treats unset and blank identifiers as disabled providers", () =>
    Effect.gen(function*() {
      const settings = yield* analyticsConfig

      expect(Option.isNone(settings.googleMeasurementId)).toBe(true)
      expect(Option.isNone(settings.cloudflareBeaconToken)).toBe(true)
    }).pipe(Effect.provide(withEnvironment({ GA_MEASUREMENT_ID: "  " }))))

  it.effect("accepts well-formed identifiers independently", () =>
    Effect.gen(function*() {
      const settings = yield* analyticsConfig

      expect(Option.getOrNull(settings.googleMeasurementId)).toBe(measurementId)
      expect(Option.isNone(settings.cloudflareBeaconToken)).toBe(true)
    }).pipe(Effect.provide(withEnvironment({ GA_MEASUREMENT_ID: measurementId }))))

  it.effect("rejects identifiers that would ship broken tags", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(analyticsConfig)

      expect(ConfigError.isInvalidData(error)).toBe(true)
    }).pipe(Effect.provide(withEnvironment({ CF_WEB_ANALYTICS_TOKEN: "not-a-token" }))))
})

describe("analytics tags and policy", () => {
  const both: AnalyticsSettings = {
    googleMeasurementId: Option.some(Schema.decodeSync(GoogleMeasurementId)(measurementId)),
    cloudflareBeaconToken: Option.some(Schema.decodeSync(CloudflareBeaconToken)(beaconToken))
  }

  it.effect("emits nothing and keeps the strict policy when no provider is configured", () =>
    Effect.sync(() => {
      const html = "<html><head><title>t</title></head><body></body></html>"

      expect(analyticsTags(disabledAnalytics)).toEqual([])
      expect(injectAnalytics(html, disabledAnalytics)).toBe(html)
      expect(contentSecurityPolicy(disabledAnalytics)).toContain("script-src 'self' 'wasm-unsafe-eval'; ")
      expect(contentSecurityPolicy(disabledAnalytics)).toContain("connect-src 'self'; ")
      expect(contentSecurityPolicy(disabledAnalytics)).not.toContain("googletagmanager")
    }))

  it.effect("loads each provider from external scripts only, with a matching policy", () =>
    Effect.sync(() => {
      const html = injectAnalytics("<html><head><title>t</title></head><body></body></html>", both)
      const policy = contentSecurityPolicy(both)

      expect(html).toContain(
        `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>`
      )
      expect(html).toContain(
        `<script defer src="/analytics/gtag-init.js" data-measurement-id="${measurementId}"></script>`
      )
      expect(html).toContain(
        `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${beaconToken}"}'></script>`
      )
      expect(html).toMatch(/<\/script>\s*<\/head>/u)
      expect(html).not.toMatch(/<script>|<script defer>/u)

      expect(policy).toContain(
        "script-src 'self' 'wasm-unsafe-eval' https://www.googletagmanager.com https://static.cloudflareinsights.com"
      )
      expect(policy).toContain(
        "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://cloudflareinsights.com"
      )
      expect(policy).toContain("img-src 'self' data: https://*.google-analytics.com https://www.googletagmanager.com")
    }))
})
