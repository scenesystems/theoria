import { Option } from "effect"

import type { MetricAppearance } from "../view/primitives/designSystem.js"

export type WidgetMetric = {
  readonly label: string
  readonly value: string
  readonly appearance?: MetricAppearance
  readonly enabled?: boolean
}

export const widgetMetric = (
  label: string,
  value: string,
  options?: {
    readonly appearance?: MetricAppearance
    readonly enabled?: boolean
  }
): WidgetMetric =>
  Option.fromNullable(options).pipe(
    Option.match({
      onNone: () => ({ label, value }),
      onSome: (resolvedOptions) => ({
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
