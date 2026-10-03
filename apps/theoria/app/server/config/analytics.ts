import { Boolean as Bool, Config, Context, Effect, Layer, Option, Schema } from "effect"
import * as Str from "effect/String"

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

export const GoogleMeasurementId = Schema.String.check(Schema.isPattern(/^G-[A-Z0-9]{4,}$/u)).pipe(
  Schema.brand("@theoria/app/server/config/Analytics/GoogleMeasurementId")
)

export type GoogleMeasurementId = typeof GoogleMeasurementId.Type

export const CloudflareBeaconToken = Schema.String.check(Schema.isPattern(/^[0-9a-f]{32}$/u)).pipe(
  Schema.brand("@theoria/app/server/config/Analytics/CloudflareBeaconToken")
)

export type CloudflareBeaconToken = typeof CloudflareBeaconToken.Type

export const AnalyticsSettings = Schema.Struct({
  googleMeasurementId: Schema.Option(GoogleMeasurementId),
  cloudflareBeaconToken: Schema.Option(CloudflareBeaconToken)
})
export type AnalyticsSettings = typeof AnalyticsSettings.Type

export class Analytics extends Context.Service<Analytics, AnalyticsSettings>()(
  "@theoria/app/server/config/Analytics"
) {}

/** Reads an optional identifier: unset or blank means disabled; anything else must match `schema`. */
const optionalIdentifier = <A extends string>(
  name: string,
  schema: Schema.Codec<A, string>
): Config.Config<Option.Option<A>> =>
  Config.String(name).pipe(
    Config.withDefault(""),
    Config.map(Str.trim),
    Config.mapEffect((value) =>
      Bool.match(Str.isEmpty(value), {
        onTrue: () => Effect.succeed(Option.none<A>()),
        onFalse: () =>
          Schema.decodeEffect(schema)(value).pipe(
            Effect.asSome,
            Effect.mapError((error) => new Config.ConfigError(error))
          )
      })
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
export const AnalyticsLive: Layer.Layer<Analytics, Config.ConfigError> = Layer.effect(Analytics, analyticsConfig)
