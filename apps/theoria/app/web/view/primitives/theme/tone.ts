import { Match } from "effect"
import * as Option from "effect/Option"

import type { EntryId } from "../../../../contracts/entry/id.js"
import { type CardTone, toneForCard as cardToneForCard } from "../../../../contracts/tone.js"

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

export const toneFor = (tone: CardTone): Tone =>
  Match.value(tone).pipe(
    Match.when("text", () => ({
      indicator: "bg-tone-text-500",
      border: "border-tone-text-500",
      borderSubtle: "border-tone-text-200/95",
      borderHover: "hover:border-tone-text-300",
      focusRing: "focus-visible:ring-tone-text-300",
      dot: "bg-tone-text-400",
      text: "text-tone-text-700",
      textStrong: "text-tone-text-900",
      textMuted: "text-tone-text-500",
      fill: "fill-tone-text-500",
      fillMuted: "fill-tone-text-300",
      stroke: "stroke-tone-text-500",
      bg: "bg-tone-text-500",
      bgSubtle: "bg-tone-text-100",
      bgTinted: "bg-tone-text-100/45"
    })),
    Match.when("search", () => ({
      indicator: "bg-tone-search-500",
      border: "border-tone-search-500",
      borderSubtle: "border-tone-search-200/95",
      borderHover: "hover:border-tone-search-300",
      focusRing: "focus-visible:ring-tone-search-300",
      dot: "bg-tone-search-400",
      text: "text-tone-search-700",
      textStrong: "text-tone-search-900",
      textMuted: "text-tone-search-500",
      fill: "fill-tone-search-500",
      fillMuted: "fill-tone-search-300",
      stroke: "stroke-tone-search-500",
      bg: "bg-tone-search-500",
      bgSubtle: "bg-tone-search-100",
      bgTinted: "bg-tone-search-100/45"
    })),
    Match.when("math", () => ({
      indicator: "bg-tone-math-500",
      border: "border-tone-math-500",
      borderSubtle: "border-tone-math-200/95",
      borderHover: "hover:border-tone-math-300",
      focusRing: "focus-visible:ring-tone-math-300",
      dot: "bg-tone-math-400",
      text: "text-tone-math-700",
      textStrong: "text-tone-math-900",
      textMuted: "text-tone-math-500",
      fill: "fill-tone-math-500",
      fillMuted: "fill-tone-math-300",
      stroke: "stroke-tone-math-500",
      bg: "bg-tone-math-500",
      bgSubtle: "bg-tone-math-100",
      bgTinted: "bg-tone-math-100/45"
    })),
    Match.when("dsp", () => ({
      indicator: "bg-tone-dsp-500",
      border: "border-tone-dsp-500",
      borderSubtle: "border-tone-dsp-200/95",
      borderHover: "hover:border-tone-dsp-300",
      focusRing: "focus-visible:ring-tone-dsp-300",
      dot: "bg-tone-dsp-400",
      text: "text-tone-dsp-700",
      textStrong: "text-tone-dsp-900",
      textMuted: "text-tone-dsp-500",
      fill: "fill-tone-dsp-500",
      fillMuted: "fill-tone-dsp-300",
      stroke: "stroke-tone-dsp-500",
      bg: "bg-tone-dsp-500",
      bgSubtle: "bg-tone-dsp-100",
      bgTinted: "bg-tone-dsp-100/45"
    })),
    Match.when("digest", () => ({
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
    })),
    Match.when("sign", () => ({
      indicator: "bg-tone-sign-500",
      border: "border-tone-sign-500",
      borderSubtle: "border-tone-sign-200/95",
      borderHover: "hover:border-tone-sign-300",
      focusRing: "focus-visible:ring-tone-sign-300",
      dot: "bg-tone-sign-400",
      text: "text-tone-sign-700",
      textStrong: "text-tone-sign-900",
      textMuted: "text-tone-sign-500",
      fill: "fill-tone-sign-500",
      fillMuted: "fill-tone-sign-300",
      stroke: "stroke-tone-sign-500",
      bg: "bg-tone-sign-500",
      bgSubtle: "bg-tone-sign-100",
      bgTinted: "bg-tone-sign-100/45"
    })),
    Match.when("seal", () => ({
      indicator: "bg-tone-seal-500",
      border: "border-tone-seal-500",
      borderSubtle: "border-tone-seal-200/95",
      borderHover: "hover:border-tone-seal-300",
      focusRing: "focus-visible:ring-tone-seal-300",
      dot: "bg-tone-seal-400",
      text: "text-tone-seal-700",
      textStrong: "text-tone-seal-900",
      textMuted: "text-tone-seal-500",
      fill: "fill-tone-seal-500",
      fillMuted: "fill-tone-seal-300",
      stroke: "stroke-tone-seal-500",
      bg: "bg-tone-seal-500",
      bgSubtle: "bg-tone-seal-100",
      bgTinted: "bg-tone-seal-100/45"
    })),
    Match.exhaustive
  )

export const toneForCard = (id: EntryId): Tone => toneFor(cardToneForCard(id))

export type MetricEmphasis = "default" | "muted" | "strong"

export type MetricAppearance =
  | { readonly _tag: "neutral" }
  | { readonly _tag: "tone"; readonly tone: CardTone }
  | { readonly _tag: "danger" }

export type MetricPillClasses = {
  readonly label: string
  readonly value: string
}

const neutralPillClasses: MetricPillClasses = { label: "text-ink-700", value: "text-ink-900" }

export const metricPillClassesFor = (
  appearance: Option.Option<MetricAppearance>,
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
