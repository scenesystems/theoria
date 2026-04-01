import { Match } from "effect"

export const formatNumber = (n: number): string => {
  if (Number.isInteger(n)) return String(n)
  const abs = Math.abs(n)
  if (abs >= 100) return n.toFixed(1)
  if (abs >= 1) return n.toFixed(2)
  return n.toPrecision(3)
}

export const formatScalar = (value: number, unit: string, format?: "fixed" | "integer" | "scientific"): string => {
  const formatted = Match.value(format).pipe(
    Match.when("integer", () => String(Math.round(value))),
    Match.when("scientific", () => value.toExponential(2)),
    Match.when("fixed", () => formatNumber(value)),
    Match.orElse(() => formatNumber(value))
  )
  return `${formatted} ${unit}`.trim()
}

export const formatDelta = (
  baseline: number,
  improved: number,
  direction: "higher-is-better" | "lower-is-better"
): {
  delta: number
  deltaPercent: number
  favorable: boolean
  deltaText: string
  percentText: string
} => {
  const delta = direction === "lower-is-better"
    ? baseline - improved
    : improved - baseline
  const denominator = Math.abs(baseline) < 1e-9 ? 1 : Math.abs(baseline)
  const deltaPercent = (delta / denominator) * 100
  const favorable = delta >= 0
  const prefix = deltaPercent >= 0 ? "+" : ""
  return {
    delta,
    deltaPercent,
    favorable,
    deltaText: formatNumber(delta),
    percentText: `${prefix}${deltaPercent.toFixed(1)}%`
  }
}

export const formatSeriesValues = (values: ReadonlyArray<number>): string => values.map(formatNumber).join(" → ")
