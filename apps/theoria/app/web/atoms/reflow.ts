import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { Effect, Layer, Option } from "effect"
import { Text } from "effect-text"
import * as Arr from "effect/Array"

import { corpus, type CorpusEntry, customCorpusEntry } from "../../contracts/corpus.js"
import type { Obstacle } from "../../contracts/obstacle.js"
import { fontDescriptorFor, semanticsFor, type TextRole } from "../../contracts/text.js"
import { browserTextLayoutLayer } from "../text/browserTextLayout.js"
import {
  projectObstacleTextLayout,
  reflowObstacleGapPx,
  type ReflowStageLine,
  type ReflowStageObstacle
} from "../text/obstacleProjection.js"

export const reflowRole: TextRole = "card-summary"

const reflowSemantics = semanticsFor(reflowRole)
const reflowFont = fontDescriptorFor(reflowSemantics)
const reflowLineHeight = reflowSemantics.lineHeight
const reflowRuntime = Atom.runtime(Layer.empty)

const defaultCorpusIndex = 0
const defaultWidth = Math.round(reflowSemantics.maxWidth.compact / 2)

export type ReflowControls = {
  readonly corpusIndex: number
  readonly width: number
  readonly obstaclesEnabled: boolean
}

const defaultReflowControls: ReflowControls = {
  corpusIndex: defaultCorpusIndex,
  width: defaultWidth,
  obstaclesEnabled: false
}

export const reflowControlsAtom: AtomType.Writable<ReflowControls> = Atom.make(defaultReflowControls)
export const reflowSliderMaxWidth: number = reflowSemantics.maxWidth.compact
export const sampleReflowWidths: ReadonlyArray<number> = [180, 280, 380, 480, 580, 680, reflowSliderMaxWidth]
export const reflowStageViewportWidthAtom: AtomType.Writable<number> = Atom.make(0)
export const reflowStageHorizontalInsetPx = 20
export const reflowStageVerticalInsetPx = 16
export const reflowStageFrameBorderPx = 1
export const customTextAtom: AtomType.Writable<string> = Atom.make("")

const reflowStageHorizontalChromePx = (reflowStageHorizontalInsetPx * 2) + (reflowStageFrameBorderPx * 2)
const reflowObstacleSafeMinWidthPx = 250
const reflowObstacleSafeMinRailPx = 128

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const minWidthForSceneObstacles = (sceneObstacles: ReadonlyArray<Obstacle>): number =>
  Arr.reduce(
    sceneObstacles,
    reflowObstacleSafeMinWidthPx,
    (minWidth, obstacle) => Math.max(minWidth, obstacle.widthPx + reflowObstacleGapPx + reflowObstacleSafeMinRailPx)
  )

export const resolveReflowCorpusEntry = (corpusIndex: number, customText: string): CorpusEntry => {
  const trimmedText = customText.trim()

  return corpusIndex >= corpus.length
    ? trimmedText.length > 0
      ? { ...customCorpusEntry, text: trimmedText }
      : corpus[0]!
    : (corpus[corpusIndex] ?? corpus[0]!)
}

export const reflowMinWidthFor = (
  stageMaxWidth: number,
  obstaclesEnabled = false,
  sceneObstacles: ReadonlyArray<Obstacle> = []
): number =>
  Math.min(
    obstaclesEnabled
      ? Math.max(Math.round(reflowSliderMaxWidth / 4), minWidthForSceneObstacles(sceneObstacles))
      : Math.round(reflowSliderMaxWidth / 4),
    stageMaxWidth
  )

export const resolveReflowStageMaxWidth = (viewportWidth: number): number =>
  viewportWidth > 0
    ? Math.min(
      reflowSliderMaxWidth,
      Math.max(1, viewportWidth - reflowStageHorizontalChromePx)
    )
    : reflowSliderMaxWidth

export const resolveReflowStageWidth = (
  requestedWidth: number,
  viewportWidth: number,
  obstaclesEnabled = false,
  sceneObstacles: ReadonlyArray<Obstacle> = []
): number => {
  const stageMaxWidth = resolveReflowStageMaxWidth(viewportWidth)
  return clampNumber(requestedWidth, reflowMinWidthFor(stageMaxWidth, obstaclesEnabled, sceneObstacles), stageMaxWidth)
}

export const customCorpusEntryAtom: AtomType.Atom<CorpusEntry | null> = Atom.make(
  (get: AtomType.Context) => {
    const text = get(customTextAtom)
    return text.trim().length > 0
      ? { ...customCorpusEntry, text: text.trim() }
      : null
  }
)

const prepareInputForEntry = (entry: CorpusEntry): Text.PrepareInputType => ({
  text: entry.text,
  font: reflowFont,
  whiteSpace: reflowSemantics.whiteSpace
})

const prepareInput = (corpusIndex: number): Text.PrepareInputType =>
  prepareInputForEntry(resolveReflowCorpusEntry(corpusIndex, ""))

export type EffectTextRunPlanStep = {
  readonly requestedWidthPx: number
  readonly stageWidthPx: number
  readonly obstaclesEnabled: boolean
}

export type EffectTextRunPlanEntry = {
  readonly corpusIndex: number
  readonly label: string
  readonly steps: ReadonlyArray<EffectTextRunPlanStep>
}

export type EffectTextRunPlan = {
  readonly _tag: "effect-text"
  readonly customText: string
  readonly viewportWidthPx: number
  readonly entries: ReadonlyArray<EffectTextRunPlanEntry>
}

const preparedResultAtom = Atom.family(
  (corpusIndex: number) =>
    reflowRuntime.atom(
      () =>
        Text.prepare(prepareInput(corpusIndex)).pipe(
          Effect.provide(browserTextLayoutLayer)
        ),
      { initialValue: null }
    )
)

const customPreparedResultAtom = Atom.family(
  (text: string) =>
    reflowRuntime.atom(
      () =>
        text.trim().length > 0
          ? Text.prepare({
            text: text.trim(),
            font: reflowFont,
            whiteSpace: reflowSemantics.whiteSpace
          }).pipe(Effect.provide(browserTextLayoutLayer))
          : Effect.succeed(null),
      { initialValue: null }
    )
)

export type ReflowProjection = {
  readonly baselineSummary: Text.LayoutSummaryType
  readonly summary: Text.LayoutSummaryType
  readonly requestedWidthPx: number
  readonly stageWidthPx: number
  readonly effectiveWidthPx: number
  readonly obstacleDelta: number
  readonly canvasHeightPx: number
  readonly lineHeight: number
  readonly prepared: boolean
  readonly corpusLabel: string
  readonly corpusText: string
  readonly sceneSummary: string
  readonly sceneObstacles: ReadonlyArray<Obstacle>
  readonly lines: ReadonlyArray<ReflowStageLine>
  readonly stageObstacles: ReadonlyArray<ReflowStageObstacle>
}

export type EffectTextRunFrame = {
  readonly _tag: "effect-text"
  readonly controls: ReflowControls
  readonly projection: ReflowProjection
}

const reflowPlanStepsForEntry = (
  entry: CorpusEntry,
  viewportWidthPx: number
): ReadonlyArray<EffectTextRunPlanStep> =>
  Arr.appendAll(
    Arr.map(sampleReflowWidths, (requestedWidthPx): EffectTextRunPlanStep => ({
      requestedWidthPx,
      stageWidthPx: resolveReflowStageWidth(requestedWidthPx, viewportWidthPx, false, entry.scene.obstacles),
      obstaclesEnabled: false
    })),
    Arr.map(sampleReflowWidths, (requestedWidthPx): EffectTextRunPlanStep => ({
      requestedWidthPx,
      stageWidthPx: resolveReflowStageWidth(requestedWidthPx, viewportWidthPx, true, entry.scene.obstacles),
      obstaclesEnabled: true
    }))
  )

export const snapshotEffectTextRunPlan = ({
  customText,
  viewportWidthPx
}: {
  readonly customText: string
  readonly viewportWidthPx: number
}): EffectTextRunPlan => {
  const baseEntries = Arr.map(corpus, (entry, corpusIndex) => ({ corpusIndex, entry }))
  const plannedEntries = customText.trim().length > 0
    ? [{ corpusIndex: corpus.length, entry: resolveReflowCorpusEntry(corpus.length, customText) }, ...baseEntries]
    : baseEntries

  return {
    _tag: "effect-text",
    customText,
    viewportWidthPx,
    entries: Arr.map(plannedEntries, ({ corpusIndex, entry }): EffectTextRunPlanEntry => ({
      corpusIndex,
      label: entry.label,
      steps: reflowPlanStepsForEntry(entry, viewportWidthPx)
    }))
  }
}

export const prepareReflowEntry = (entry: CorpusEntry): Effect.Effect<Text.PreparedText, never, never> =>
  Text.prepare(prepareInputForEntry(entry)).pipe(
    Effect.provide(browserTextLayoutLayer),
    Effect.orDie
  )

export const projectReflowProjection = ({
  entry,
  obstaclesEnabled,
  prepared,
  requestedWidthPx,
  stageWidthPx
}: {
  readonly entry: CorpusEntry
  readonly obstaclesEnabled: boolean
  readonly prepared: Text.PreparedText
  readonly requestedWidthPx: number
  readonly stageWidthPx: number
}): ReflowProjection => {
  const request = { maxWidth: stageWidthPx, lineHeight: reflowLineHeight }
  const baselineSummary = Text.layout(prepared, request)
  const baselineLines = Text.layoutLines(prepared, request).map((line) => ({
    ...line,
    leftInsetPx: 0,
    rightInsetPx: 0,
    availableWidthPx: stageWidthPx
  }))
  const obstacleProjection = obstaclesEnabled
    ? projectObstacleTextLayout({
      baselineSummary,
      obstacles: entry.scene.obstacles,
      prepared,
      request
    })
    : null

  return {
    baselineSummary,
    summary: obstacleProjection?.summary ?? baselineSummary,
    requestedWidthPx,
    stageWidthPx,
    effectiveWidthPx: obstacleProjection?.effectiveWidthPx ?? stageWidthPx,
    obstacleDelta: obstacleProjection === null
      ? 0
      : obstacleProjection.summary.lineCount - baselineSummary.lineCount,
    canvasHeightPx: obstacleProjection?.canvasHeightPx ?? baselineSummary.height,
    lineHeight: reflowLineHeight,
    prepared: true,
    corpusLabel: entry.label,
    corpusText: entry.text,
    sceneSummary: entry.scene.summary,
    sceneObstacles: entry.scene.obstacles,
    lines: obstacleProjection?.lines ?? baselineLines,
    stageObstacles: obstacleProjection?.obstacles ?? []
  }
}

export const reflowProjectionAtom: AtomType.Atom<ReflowProjection | null> = Atom.make(
  (get: AtomType.Context) => {
    const { corpusIndex, obstaclesEnabled, width: requestedWidthPx } = get(reflowControlsAtom)
    const viewportWidth = get(reflowStageViewportWidthAtom)
    const isCustom = corpusIndex >= corpus.length
    const customText = isCustom ? get(customTextAtom) : ""
    const entry = resolveReflowCorpusEntry(corpusIndex, customText)
    const sceneObstacles = entry.scene.obstacles
    const stageWidthPx = resolveReflowStageWidth(requestedWidthPx, viewportWidth, obstaclesEnabled, sceneObstacles)
    const hasCustomText = isCustom && customText.trim().length > 0
    const result = hasCustomText
      ? get(customPreparedResultAtom(customText))
      : get(preparedResultAtom(isCustom ? 0 : corpusIndex))
    const prepared = Result.value(result).pipe(Option.flatMap(Option.fromNullable))

    return Option.match(prepared, {
      onNone: () => null,
      onSome: (handle) =>
        projectReflowProjection({
          entry,
          obstaclesEnabled,
          prepared: handle,
          requestedWidthPx,
          stageWidthPx
        })
    })
  }
)
