import { Clock, Effect, Option, type Scope } from "effect"

import { Text } from "effect-text"
import { corpus } from "../../../contracts/corpus.js"
import { effectTextProjectionWidths as widths } from "../../../contracts/demo/text.js"
import { legalPolicyScene } from "../../../contracts/reflow-scenes.js"
import type { LayoutProjection } from "./projection.js"

export const focusWidth = 220
export const sampleCorpusLabel = corpus[0]?.label ?? "none"

const obstacleDefinitions = legalPolicyScene.obstacles

export type MeasuredValue<A> = {
  readonly value: A
  readonly durationMs: number
}

export type ObstacleProjection = {
  readonly lineCount: number
  readonly obstacleCount: number
}

export type CachedEffectTextMeasurements = {
  readonly getBaseline: Effect.Effect<MeasuredValue<ReadonlyArray<LayoutProjection>>, unknown, never>
  readonly getOptimized: Effect.Effect<MeasuredValue<ReadonlyArray<LayoutProjection>>, unknown, never>
  readonly getObstacles: Effect.Effect<ObstacleProjection, unknown, never>
}

export const textInput = (text: string): Text.PrepareInputType => ({
  text,
  font: { family: "Avenir", size: 16, weight: 400 },
  whiteSpace: "normal"
})

const projectLayout = (
  id: string,
  label: string,
  text: string,
  width: number,
  lineCount: number,
  sampleLine: string
): LayoutProjection => ({
  id,
  label,
  width,
  lineCount,
  sampleLine,
  characters: text.length
})

export const baselineLayouts = Effect.forEach(
  corpus,
  (entry) =>
    Effect.forEach(
      widths,
      (width) =>
        Text.prepare(textInput(entry.text)).pipe(Effect.map((prepared) => {
          const summary = Text.layout(prepared, {
            maxWidth: width,
            lineHeight: 20
          })
          const lines = Text.layoutLines(prepared, {
            maxWidth: width,
            lineHeight: 20
          })
          const firstLine = Option.fromNullable(lines.at(0))

          return projectLayout(
            entry.id,
            entry.label,
            entry.text,
            width,
            summary.lineCount,
            Option.match(firstLine, {
              onNone: () => "",
              onSome: (line) => line.text
            })
          )
        })),
      { concurrency: 1 }
    ),
  { concurrency: 1 }
).pipe(
  Effect.map((entries) => entries.flatMap((entry) => entry)),
  Effect.provide(Text.TextLayoutLive)
)

export const optimizedLayouts = Effect.forEach(
  corpus,
  (entry) =>
    Text.prepare(textInput(entry.text)).pipe(
      Effect.flatMap((prepared) =>
        Effect.forEach(
          widths,
          (width) =>
            Effect.sync(() => {
              const summary = Text.layout(prepared, {
                maxWidth: width,
                lineHeight: 20
              })
              const lines = Text.layoutLines(prepared, {
                maxWidth: width,
                lineHeight: 20
              })
              const firstLine = Option.fromNullable(lines.at(0))

              return projectLayout(
                entry.id,
                entry.label,
                entry.text,
                width,
                summary.lineCount,
                Option.match(firstLine, {
                  onNone: () => "",
                  onSome: (line) => line.text
                })
              )
            }),
          { concurrency: 1 }
        )
      )
    ),
  { concurrency: 1 }
).pipe(
  Effect.map((entries) => entries.flatMap((entry) => entry)),
  Effect.provide(Text.TextLayoutLive)
)

export const measured = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<MeasuredValue<A>, E, R> =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const value = yield* effect
    const endedAt = yield* Clock.currentTimeMillis

    return {
      value,
      durationMs: endedAt - startedAt
    }
  })

export const obstacleProjection: Effect.Effect<ObstacleProjection, unknown, never> = Effect.gen(function*() {
  const sampleEntry = corpus[0] ?? null
  const prepared = yield* Text.prepare(textInput(sampleEntry?.text ?? ""))
  const summary = Text.layout(prepared, { maxWidth: focusWidth, lineHeight: 20 })

  return {
    lineCount: summary.lineCount,
    obstacleCount: obstacleDefinitions.length
  }
}).pipe(Effect.provide(Text.TextLayoutLive))

export const cachedEffectTextMeasurements: Effect.Effect<CachedEffectTextMeasurements, never, Scope.Scope> = Effect.gen(
  function*() {
    const getBaseline = yield* Effect.cached(measured(baselineLayouts))
    const getOptimized = yield* Effect.cached(measured(optimizedLayouts))
    const getObstacles = yield* Effect.cached(obstacleProjection)

    return {
      getBaseline,
      getOptimized,
      getObstacles
    }
  }
)
