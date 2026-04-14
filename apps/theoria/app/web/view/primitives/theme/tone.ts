import { Match } from "effect"
import * as Option from "effect/Option"

import type { PresentationMetricAppearance } from "../../../../contracts/presentation/metric.js"
import type { CardTone } from "../../../../contracts/tone.js"

export type Tone = {
  readonly indicator: string
  readonly border: string
  readonly borderSubtle: string
  readonly borderHover: string
  readonly focusRing: string
  readonly dot: string
  readonly text: string
  readonly textStrong: string
  readonly textMuted: string
  readonly fill: string
  readonly fillMuted: string
  readonly stroke: string
  readonly bg: string
  readonly bgSubtle: string
  readonly bgTinted: string
}

export const neutralTone: Tone = {
  indicator: "bg-stage-400",
  border: "border-stage-400",
  borderSubtle: "border-stage-200/95",
  borderHover: "hover:border-stage-300",
  focusRing: "focus-visible:ring-stage-300",
  dot: "bg-stage-400",
  text: "text-ink-700",
  textStrong: "text-ink-900",
  textMuted: "text-ink-500",
  fill: "fill-ink-700",
  fillMuted: "fill-ink-400",
  stroke: "stroke-ink-700",
  bg: "bg-stage-400",
  bgSubtle: "bg-stage-100",
  bgTinted: "bg-stage-100/70"
}

const digestTone: Tone = {
  indicator: "bg-tone-digest-500",
  border: "border-tone-digest-500",
  borderSubtle: "border-tone-digest-200/95",
  borderHover: "hover:border-tone-digest-300",
  focusRing: "focus-visible:ring-tone-digest-300",
  dot: "bg-tone-digest-400",
  text: "text-tone-digest-700",
  textStrong: "text-tone-digest-900",
  textMuted: "text-tone-digest-500",
  fill: "fill-tone-digest-500",
  fillMuted: "fill-tone-digest-300",
  stroke: "stroke-tone-digest-500",
  bg: "bg-tone-digest-500",
  bgSubtle: "bg-tone-digest-100",
  bgTinted: "bg-tone-digest-100/45"
}

export const toneFor = (_tone: CardTone): Tone => digestTone

export const toneForCard = (_id: string): Tone => digestTone

export type MetricEmphasis = "default" | "muted" | "strong"

export type MetricPillClasses = {
  readonly label: string
  readonly value: string
}

const neutralPillClasses: MetricPillClasses = { label: "text-ink-700", value: "text-ink-900" }

export const metricPillClassesFor = (
  appearance: Option.Option<PresentationMetricAppearance>,
  enabled: boolean
): MetricPillClasses =>
  !enabled
    ? neutralPillClasses
    : Option.match(appearance, {
      onNone: () => neutralPillClasses,
      onSome: (resolvedAppearance) =>
        Match.value(resolvedAppearance).pipe(
          Match.tag("neutral", () => neutralPillClasses),
          Match.tag("danger", () => ({ label: "text-ink-700", value: "text-danger-600" })),
          Match.tag("tone", ({ tone }) => ({ label: "text-ink-700", value: toneFor(tone).text })),
          Match.exhaustive
        )
    })

export type ContentCardTone = {
  readonly border: string
  readonly bg: string
}

export const contentCardToneFor = (tone: CardTone): ContentCardTone => {
  const classes = toneFor(tone)
  return { border: classes.borderSubtle, bg: classes.bgTinted }
}

export const contentCardDangerTone: ContentCardTone = {
  border: "border-danger-200/80",
  bg: "bg-danger-50/70"
}
