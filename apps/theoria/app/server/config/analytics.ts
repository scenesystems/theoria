import { Config, ConfigError, Context, Either, Layer, Option, Schema } from "effect"

/**
 * Analytics configuration. Both providers are optional and independent:
 *
 *   GA_MEASUREMENT_ID        Google Analytics 4 measurement ID (`G-…`)
 *   CF_WEB_ANALYTICS_TOKEN   Cloudflare Web Analytics site token (32 hex chars)
 *
 * Each is a plain Wrangler `var`; the values are public by nature since they
 * ship in the HTML. An unset or empty value disables that provider. A value
 * that does not look like a valid identifier is a configuration error and the
 * server refuses to start (see `AppLayer`).
 */

export const GoogleMeasurementId = Schema.String.pipe(
  Schema.pattern(/^G-[A-Z0-9]{4,}$/u),
  Schema.brand("GoogleMeasurementId")
)

export type GoogleMeasurementId = typeof GoogleMeasurementId.Type

export const CloudflareBeaconToken = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{32}$/u),
  Schema.brand("CloudflareBeaconToken")
)

export type CloudflareBeaconToken = typeof CloudflareBeaconToken.Type

export const AnalyticsSettings = Schema.Struct({
  googleMeasurementId: Schema.OptionFromSelf(GoogleMeasurementId),
  cloudflareBeaconToken: Schema.OptionFromSelf(CloudflareBeaconToken)
})
export type AnalyticsSettings = typeof AnalyticsSettings.Type

export class Analytics extends Context.Tag("@theoria/app/server/config/Analytics")<Analytics, AnalyticsSettings>() {}

/** Reads an optional identifier: unset or blank means disabled; anything else must match `schema`. */
const optionalIdentifier = <A extends string>(
  name: string,
  schema: Schema.Schema<A, string>
): Config.Config<Option.Option<A>> =>
  Config.string(name).pipe(
    Config.withDefault(""),
    Config.map((value) => value.trim()),
    Config.mapOrFail((value) =>
      value.length === 0
        ? Either.right(Option.none<A>())
        : Schema.decodeEither(schema)(value).pipe(
          Either.map(Option.some),
          Either.mapLeft(() => ConfigError.InvalidData([name], `${name} is not a valid identifier: ${value}`))
        )
    )
  )

export const analyticsConfig: Config.Config<AnalyticsSettings> = Config.all({
  googleMeasurementId: optionalIdentifier("GA_MEASUREMENT_ID", GoogleMeasurementId),
  cloudflareBeaconToken: optionalIdentifier("CF_WEB_ANALYTICS_TOKEN", CloudflareBeaconToken)
})

export const disabledAnalytics: AnalyticsSettings = {
  googleMeasurementId: Option.none(),
  cloudflareBeaconToken: Option.none()
}

/** Fails layer construction with the `ConfigError` when either identifier is malformed. */
export const AnalyticsLive: Layer.Layer<Analytics, ConfigError.ConfigError> = Layer.effect(Analytics, analyticsConfig)
