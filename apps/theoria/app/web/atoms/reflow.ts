import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Result } from "@effect-atom/atom"
import { Effect, Layer, Option } from "effect"
import { Text } from "effect-text"

import {
  defaultEffectTextSurfaceControls,
  type EffectTextSurfaceControls
} from "../../contracts/capability/effect-text-surface.js"
import {
  projectionMinWidthFor,
  resolveCorpusEntry,
  resolveStageMaxWidth,
  resolveStageWidth,
  stageFrameBorderPx,
  stageHorizontalInsetPx,
  stageSliderMaxWidth
} from "../../contracts/capability/effect-text.js"
import { corpus, type CorpusEntry, customCorpusEntry } from "../../contracts/corpus.js"
import { defaultEffectTextEntryInput } from "../../contracts/entry/defaults.js"
import type { Obstacle } from "../../contracts/obstacle.js"
import { fontDescriptorFor, semanticsFor, type TextRole } from "../../contracts/presentation/text.js"
import { projectObstacleTextLayout } from "../text/obstacleProjection.js"
import type { ReflowStageLine, ReflowStageObstacle } from "../text/obstacleStageModel.js"
import { prepareBrowserText } from "../view/text/authority.js"

export const reflowRole: TextRole = "card-summary"

const reflowSemantics = semanticsFor(reflowRole)
const reflowFont = fontDescriptorFor(reflowSemantics)
const reflowLineHeight = reflowSemantics.lineHeight
const reflowRuntime = Atom.runtime(Layer.empty)

export type ReflowControls = EffectTextSurfaceControls

export const reflowControlsAtom: AtomType.Writable<ReflowControls> = Atom.make(defaultEffectTextSurfaceControls)
export const reflowSliderMaxWidth: number = stageSliderMaxWidth
export const reflowStageViewportWidthAtom: AtomType.Writable<number> = Atom.make(
  defaultEffectTextEntryInput.viewportWidthPx
)
export const reflowStageHorizontalInsetPx = stageHorizontalInsetPx
export const reflowStageVerticalInsetPx = 16
export const reflowStageFrameBorderPx = stageFrameBorderPx
export const customTextAtom: AtomType.Writable<string> = Atom.make(defaultEffectTextEntryInput.customText)

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const resolveReflowCorpusEntry = resolveCorpusEntry

export const reflowMinWidthFor = projectionMinWidthFor

export const resolveReflowStageMaxWidth = resolveStageMaxWidth

export const resolveReflowStageWidth = (
  requestedWidth: number,
  viewportWidth: number,
  obstaclesEnabled = false,
  sceneObstacles: ReadonlyArray<Obstacle> = []
): number =>
  clampNumber(
    resolveStageWidth(requestedWidth, viewportWidth, obstaclesEnabled, sceneObstacles),
    0,
    stageSliderMaxWidth
  )

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

const preparedResultAtom = Atom.family(
  (corpusIndex: number) =>
    reflowRuntime.atom(
      () => prepareBrowserText(prepareInput(corpusIndex)),
      { initialValue: null }
    )
)

const customPreparedResultAtom = Atom.family(
  (text: string) =>
    reflowRuntime.atom(
      () =>
        text.trim().length > 0
          ? prepareBrowserText({
            text: text.trim(),
            font: reflowFont,
            whiteSpace: reflowSemantics.whiteSpace
          })
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

export const isEffectTextRunFrame = (frame: { readonly _tag: string } | null): frame is EffectTextRunFrame =>
  frame !== null && frame._tag === "effect-text"

export const prepareReflowEntry = (entry: CorpusEntry): Effect.Effect<Text.PreparedTextWithSegments, never, never> =>
  prepareBrowserText(prepareInputForEntry(entry)).pipe(Effect.orDie)

export const projectReflowProjection = ({
  entry,
  obstaclesEnabled,
  prepared,
  requestedWidthPx,
  stageWidthPx
}: {
  readonly entry: CorpusEntry
  readonly obstaclesEnabled: boolean
  readonly prepared: Text.PreparedTextWithSegments
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
