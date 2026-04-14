import { Option, Schema } from "effect"

import { CardTone } from "../tone.js"

export const PresentationMetricAppearance = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal("neutral") }),
  Schema.Struct({ _tag: Schema.Literal("danger") }),
  Schema.Struct({ _tag: Schema.Literal("tone"), tone: CardTone })
)

export type PresentationMetricAppearance = typeof PresentationMetricAppearance.Type

export class PresentationMetric extends Schema.Class<PresentationMetric>("PresentationMetric")({
  label: Schema.String,
  value: Schema.String,
  appearance: Schema.optional(PresentationMetricAppearance),
  enabled: Schema.optional(Schema.Boolean)
}) {}

export const presentationMetricNeutralAppearance = (): PresentationMetricAppearance => ({ _tag: "neutral" })

export const presentationMetricDangerAppearance = (): PresentationMetricAppearance => ({ _tag: "danger" })

export const presentationMetricToneAppearance = (tone: typeof CardTone.Type): PresentationMetricAppearance => ({
  _tag: "tone",
  tone
})

export const presentationMetric = (
  label: string,
  value: string,
  options?: {
    readonly appearance?: PresentationMetricAppearance
    readonly enabled?: boolean
  }
): PresentationMetric =>
  Option.fromNullable(options).pipe(
    Option.match({
      onNone: () => PresentationMetric.make({ label, value }),
      onSome: (resolvedOptions) =>
        PresentationMetric.make({
          label,
          value,
          ...Option.fromNullable(resolvedOptions.appearance).pipe(
            Option.match({
              onNone: () => ({}),
              onSome: (appearance) => ({ appearance })
            })
          ),
          ...Option.fromNullable(resolvedOptions.enabled).pipe(
            Option.match({
              onNone: () => ({}),
              onSome: (enabled) => ({ enabled })
            })
          )
        })
    })
  )
