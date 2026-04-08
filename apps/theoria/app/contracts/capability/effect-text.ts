import { Schema } from "effect"
import * as Arr from "effect/Array"

import { corpus, type CorpusEntry, customCorpusEntry } from "../corpus.js"
import type { Obstacle } from "../obstacle.js"
import { semanticsFor } from "../presentation/text.js"

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

// ---------------------------------------------------------------------------
// Projection geometry — shared between server and web
// ---------------------------------------------------------------------------

const reflowSemantics = semanticsFor("card-summary")

export const projectionStepCount = 16

export const stageHorizontalInsetPx = 20
export const stageFrameBorderPx = 1
const stageHorizontalChromePx = (stageHorizontalInsetPx * 2) + (stageFrameBorderPx * 2)

export const obstacleGapPx = 16
export const obstacleSafeMinWidthPx = 250
export const obstacleSafeMinRailPx = 128

export const stageSliderMaxWidth: number = reflowSemantics.maxWidth.compact

const minWidthForSceneObstacles = (sceneObstacles: ReadonlyArray<Obstacle>): number =>
  Arr.reduce(
    sceneObstacles,
    obstacleSafeMinWidthPx,
    (minWidth, obstacle) => Math.max(minWidth, obstacle.widthPx + obstacleGapPx + obstacleSafeMinRailPx)
  )

export const projectionMinWidthFor = (
  stageMaxWidth: number,
  obstaclesEnabled = false,
  sceneObstacles: ReadonlyArray<Obstacle> = []
): number =>
  Math.min(
    obstaclesEnabled
      ? Math.max(Math.round(stageSliderMaxWidth / 4), minWidthForSceneObstacles(sceneObstacles))
      : Math.round(stageSliderMaxWidth / 4),
    stageMaxWidth
  )

export const resolveStageMaxWidth = (viewportWidthPx: number): number =>
  viewportWidthPx > 0
    ? Math.min(stageSliderMaxWidth, Math.max(1, viewportWidthPx - stageHorizontalChromePx))
    : stageSliderMaxWidth

export const resolveStageWidth = (
  requestedWidthPx: number,
  viewportWidthPx: number,
  obstaclesEnabled = false,
  sceneObstacles: ReadonlyArray<Obstacle> = []
): number => {
  const stageMaxWidth = resolveStageMaxWidth(viewportWidthPx)

  return Math.min(
    stageMaxWidth,
    Math.max(projectionMinWidthFor(stageMaxWidth, obstaclesEnabled, sceneObstacles), requestedWidthPx)
  )
}

export const partitionProjectionWidths = (
  minPx: number,
  maxPx: number,
  count: number = projectionStepCount
): ReadonlyArray<number> => {
  const clamped = Math.max(minPx, Math.min(minPx, maxPx))
  const range = Math.max(0, maxPx - clamped)
  const step = count > 1 ? range / (count - 1) : 0

  return Arr.makeBy(count, (i) => Math.round(clamped + step * i))
}

export const resolveCorpusEntry = (corpusIndex: number, customText: string): CorpusEntry => {
  const trimmedText = customText.trim()

  return corpusIndex >= corpus.length
    ? trimmedText.length > 0
      ? { ...customCorpusEntry, text: trimmedText }
      : corpus[0]!
    : (corpus[corpusIndex] ?? corpus[0]!)
}

const projectionPlanStepsForEntry = (
  entry: CorpusEntry,
  viewportWidthPx: number
): ReadonlyArray<{
  readonly requestedWidthPx: number
  readonly stageWidthPx: number
  readonly obstaclesEnabled: boolean
}> => {
  const stageMaxWidth = resolveStageMaxWidth(viewportWidthPx)
  const baseMinWidth = projectionMinWidthFor(stageMaxWidth, false, entry.scene.obstacles)
  const obstacleMinWidth = projectionMinWidthFor(stageMaxWidth, true, entry.scene.obstacles)
  const baseWidths = partitionProjectionWidths(baseMinWidth, stageMaxWidth, projectionStepCount)
  const obstacleWidths = partitionProjectionWidths(obstacleMinWidth, stageMaxWidth, projectionStepCount)

  return Arr.appendAll(
    Arr.map(baseWidths, (widthPx) => ({
      requestedWidthPx: widthPx,
      stageWidthPx: widthPx,
      obstaclesEnabled: false
    })),
    Arr.map(obstacleWidths, (widthPx) => ({
      requestedWidthPx: widthPx,
      stageWidthPx: widthPx,
      obstaclesEnabled: true
    }))
  )
}

export const viewportProjectionSteps = (
  customText: string,
  viewportWidthPx: number
): ReadonlyArray<EffectTextProjectionStep> => {
  const entries = customText.trim().length > 0
    ? Arr.prepend(Arr.map(corpus, (_, i) => i), corpus.length)
    : Arr.map(corpus, (_, i) => i)

  return Arr.flatMap(entries, (corpusIndex) => {
    const entry = resolveCorpusEntry(corpusIndex, customText)

    return Arr.map(
      projectionPlanStepsForEntry(entry, viewportWidthPx),
      (planStep) =>
        new EffectTextProjectionStep({
          corpusIndex,
          requestedWidthPx: planStep.requestedWidthPx,
          stageWidthPx: planStep.stageWidthPx,
          obstaclesEnabled: planStep.obstaclesEnabled
        })
    )
  })
}

// ---------------------------------------------------------------------------
// Server-fallback widths (no viewport context)
// ---------------------------------------------------------------------------

/**
 * Server-fallback projection widths used when no viewport context is available.
 * When the browser provides `viewportWidthPx`, the server instead computes
 * widths via {@link viewportProjectionSteps} from the viewport's slider range,
 * exactly matching the client's frozen plan.
 */
export const effectTextProjectionWidths: ReadonlyArray<number> = [
  160,
  180,
  200,
  220,
  240,
  260,
  280,
  300,
  320,
  340,
  360,
  380,
  400,
  440,
  480,
  520
]

export const EffectTextProjectionInstruction = Schema.Struct({
  requestedWidthPx: PositiveInt,
  obstaclesEnabled: Schema.Boolean
})

export type EffectTextProjectionInstruction = typeof EffectTextProjectionInstruction.Type

export const EffectTextProjectionScriptEntry = Schema.Struct({
  corpusIndex: NonNegativeInt,
  steps: Schema.Array(EffectTextProjectionInstruction)
})

export type EffectTextProjectionScriptEntry = typeof EffectTextProjectionScriptEntry.Type

export class EffectTextProjectionStep
  extends Schema.TaggedClass<EffectTextProjectionStep>()("EffectTextProjectionStep", {
    corpusIndex: NonNegativeInt,
    requestedWidthPx: PositiveInt,
    stageWidthPx: PositiveInt,
    obstaclesEnabled: Schema.Boolean
  })
{}

export const EffectTextRunManifestStep = Schema.Struct({
  requestedWidthPx: PositiveInt,
  stageWidthPx: PositiveInt,
  obstaclesEnabled: Schema.Boolean
})

export type EffectTextRunManifestStep = typeof EffectTextRunManifestStep.Type

export const EffectTextRunManifestEntry = Schema.Struct({
  corpusIndex: NonNegativeInt,
  steps: Schema.Array(EffectTextRunManifestStep)
})

export type EffectTextRunManifestEntry = typeof EffectTextRunManifestEntry.Type

export const EffectTextRunManifest = Schema.Struct({
  customText: Schema.String,
  viewportWidthPx: NonNegativeInt,
  entries: Schema.Array(EffectTextRunManifestEntry)
})

export type EffectTextRunManifest = typeof EffectTextRunManifest.Type

export const EffectTextTraversalScriptEntry = Schema.Struct({
  corpusIndex: NonNegativeInt,
  label: NonEmptyString,
  steps: Schema.Array(EffectTextRunManifestStep)
})

export type EffectTextTraversalScriptEntry = typeof EffectTextTraversalScriptEntry.Type

export const EffectTextTraversalScript = Schema.Struct({
  _tag: Schema.Literal("effect-text"),
  customText: Schema.String,
  viewportWidthPx: NonNegativeInt,
  entries: Schema.Array(EffectTextTraversalScriptEntry)
})

export type EffectTextTraversalScript = typeof EffectTextTraversalScript.Type

export const isEffectTextTraversalScript = Schema.is(EffectTextTraversalScript)

const effectTextTraversalScriptStepsForEntry = (
  entry: CorpusEntry,
  viewportWidthPx: number
): ReadonlyArray<EffectTextRunManifestStep> => {
  const stageMaxWidth = resolveStageMaxWidth(viewportWidthPx)
  const baseMinWidth = projectionMinWidthFor(stageMaxWidth, false, entry.scene.obstacles)
  const obstacleMinWidth = projectionMinWidthFor(stageMaxWidth, true, entry.scene.obstacles)
  const baseWidths = partitionProjectionWidths(baseMinWidth, stageMaxWidth, projectionStepCount)
  const obstacleWidths = partitionProjectionWidths(obstacleMinWidth, stageMaxWidth, projectionStepCount)

  return Arr.appendAll(
    Arr.map(baseWidths, (requestedWidthPx): EffectTextRunManifestStep => ({
      requestedWidthPx,
      stageWidthPx: requestedWidthPx,
      obstaclesEnabled: false
    })),
    Arr.map(obstacleWidths, (requestedWidthPx): EffectTextRunManifestStep => ({
      requestedWidthPx,
      stageWidthPx: requestedWidthPx,
      obstaclesEnabled: true
    }))
  )
}

export const snapshotEffectTextTraversalScript = ({
  customText,
  viewportWidthPx
}: {
  readonly customText: string
  readonly viewportWidthPx: number
}): EffectTextTraversalScript => {
  const corpusEntries = Arr.map(corpus, (_, corpusIndex) => corpusIndex)
  const allEntries = customText.trim().length > 0
    ? Arr.prepend(corpusEntries, corpus.length)
    : corpusEntries

  return {
    _tag: "effect-text",
    customText,
    viewportWidthPx,
    entries: Arr.map(allEntries, (corpusIndex): EffectTextTraversalScriptEntry => {
      const entry = resolveCorpusEntry(corpusIndex, customText)

      return {
        corpusIndex,
        label: entry.label,
        steps: effectTextTraversalScriptStepsForEntry(entry, viewportWidthPx)
      }
    })
  }
}

const projectionInstructions: ReadonlyArray<EffectTextProjectionInstruction> = Arr.appendAll(
  Arr.map(effectTextProjectionWidths, (requestedWidthPx): EffectTextProjectionInstruction => ({
    requestedWidthPx,
    obstaclesEnabled: false
  })),
  Arr.map(effectTextProjectionWidths, (requestedWidthPx): EffectTextProjectionInstruction => ({
    requestedWidthPx,
    obstaclesEnabled: true
  }))
)

const scriptEntry = (corpusIndex: number): EffectTextProjectionScriptEntry => ({
  corpusIndex,
  steps: projectionInstructions
})

export const effectTextProjectionScript = (customText: string): ReadonlyArray<EffectTextProjectionScriptEntry> => {
  const baseEntries = Arr.map(corpus, (_entry, corpusIndex) => scriptEntry(corpusIndex))

  return customText.trim().length > 0
    ? [scriptEntry(corpus.length), ...baseEntries]
    : baseEntries
}

export const effectTextProjectionSteps = (customText: string): ReadonlyArray<EffectTextProjectionStep> =>
  Arr.flatMap(
    effectTextProjectionScript(customText),
    (entry) =>
      Arr.map(entry.steps, (step) =>
        new EffectTextProjectionStep({
          corpusIndex: entry.corpusIndex,
          requestedWidthPx: step.requestedWidthPx,
          stageWidthPx: step.requestedWidthPx,
          obstaclesEnabled: step.obstaclesEnabled
        }))
  )

export const effectTextProjectionStepsFromManifest = (
  manifest: EffectTextRunManifest
): ReadonlyArray<EffectTextProjectionStep> =>
  Arr.flatMap(
    manifest.entries,
    (entry) =>
      Arr.map(entry.steps, (step) =>
        new EffectTextProjectionStep({
          corpusIndex: entry.corpusIndex,
          requestedWidthPx: step.requestedWidthPx,
          stageWidthPx: step.stageWidthPx,
          obstaclesEnabled: step.obstaclesEnabled
        }))
  )
