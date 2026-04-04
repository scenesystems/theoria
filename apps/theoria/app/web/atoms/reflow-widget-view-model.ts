import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Text } from "effect-text"
import * as Arr from "effect/Array"

import { corpus } from "../../contracts/corpus.js"
import type { Obstacle } from "../../contracts/obstacle.js"
import { isEffectTextRunFrame, isEffectTextRunPlan, type LocalRunFrame, type LocalRunPlan } from "../state/local-run.js"
import { runShowsAnimatingState, runUsesActiveFrameAuthority } from "../state/run-interaction.js"
import { browserSupportProfileId } from "../text/browserTextLayout.js"
import type { ReflowStageLine, ReflowStageObstacle } from "../text/obstacleProjection.js"
import type { MetricAppearance } from "../view/primitives/designSystem.js"
import { animatingAtom } from "./animation.js"
import {
  customTextAtom,
  reflowControlsAtom,
  reflowMinWidthFor,
  type ReflowProjection,
  reflowProjectionAtom,
  reflowStageViewportWidthAtom,
  resolveReflowCorpusEntry,
  resolveReflowStageMaxWidth,
  resolveReflowStageWidth
} from "./reflow.js"
import { surfaceActiveLocalRunFrameAtom, surfaceActiveLocalRunPlanAtom, surfaceRunStateAtom } from "./surface.js"
import { type WidgetMetric, widgetMetric } from "./widget-view-model-shared.js"

export type ReflowWidgetViewModel = {
  readonly corpusOptions: ReadonlyArray<{ readonly index: number; readonly label: string }>
  readonly selectedCorpusIndex: number
  readonly usingCustomText: boolean
  readonly customText: string
  readonly width: {
    readonly value: number
    readonly min: number
    readonly max: number
    readonly display: string
  }
  readonly obstaclesEnabled: boolean
  readonly isAnimating: boolean
  readonly metrics: ReadonlyArray<WidgetMetric>
  readonly lines: ReadonlyArray<ReflowStageLine>
  readonly stage: {
    readonly corpusLabel: string
    readonly sceneSummary: string
    readonly sceneObstacles: ReadonlyArray<Obstacle>
    readonly summary: Text.LayoutSummaryType
    readonly baselineSummary: Text.LayoutSummaryType
    readonly canvasWidthPx: number
    readonly canvasHeightPx: number
    readonly effectiveWidthPx: number
    readonly lineHeightPx: number
    readonly obstacleDelta: number
    readonly lines: ReadonlyArray<ReflowStageLine>
    readonly obstacles: ReadonlyArray<ReflowStageObstacle>
  } | null
}

const textMetricAppearance: MetricAppearance = { _tag: "tone", tone: "text" }

const reflowMetrics = ({
  obstaclesEnabled,
  projection
}: {
  readonly obstaclesEnabled: boolean
  readonly projection: NonNullable<ReflowWidgetViewModel["stage"]>
}): ReadonlyArray<WidgetMetric> => [
  widgetMetric("Lines", String(projection.summary.lineCount)),
  widgetMetric("Width", `${projection.effectiveWidthPx}px`),
  widgetMetric("Prepare", "1 handle"),
  widgetMetric("Projection", obstaclesEnabled ? "width + obstacles" : "width-only", {
    appearance: textMetricAppearance,
    enabled: true
  }),
  widgetMetric("Browser", browserSupportProfileId),
  widgetMetric("Obstacles", String(projection.sceneObstacles.length), {
    appearance: textMetricAppearance,
    enabled: obstaclesEnabled
  }),
  widgetMetric(
    "Line Δ",
    `${projection.obstacleDelta >= 0 ? "+" : ""}${projection.obstacleDelta}`,
    {
      appearance: textMetricAppearance,
      enabled: obstaclesEnabled
    }
  )
]

const reflowStage = (
  projection: ReflowProjection
): NonNullable<ReflowWidgetViewModel["stage"]> => ({
  corpusLabel: projection.corpusLabel,
  sceneSummary: projection.sceneSummary,
  sceneObstacles: projection.sceneObstacles,
  summary: projection.summary,
  baselineSummary: projection.baselineSummary,
  canvasWidthPx: projection.stageWidthPx,
  canvasHeightPx: projection.canvasHeightPx,
  effectiveWidthPx: projection.effectiveWidthPx,
  lineHeightPx: projection.lineHeight,
  obstacleDelta: projection.obstacleDelta,
  lines: projection.lines,
  obstacles: projection.stageObstacles
})

const resolveReflowProjection = ({
  activeFrame,
  manualProjection
}: {
  readonly activeFrame: Extract<LocalRunFrame, { readonly _tag: "effect-text" }> | null
  readonly manualProjection: ReflowProjection | null
}): ReflowProjection | null => activeFrame?.projection ?? manualProjection

const resolveActiveEffectTextAuthority = ({
  frame,
  plan
}: {
  readonly frame: LocalRunFrame | null
  readonly plan: LocalRunPlan | null
}): {
  readonly frame: Extract<LocalRunFrame, { readonly _tag: "effect-text" }>
  readonly plan: Extract<LocalRunPlan, { readonly _tag: "effect-text" }>
} | null =>
  isEffectTextRunPlan(plan) && isEffectTextRunFrame(frame)
    ? { frame, plan }
    : null

export const reflowWidgetViewModelAtom: AtomType.Atom<ReflowWidgetViewModel> = Atom.make(
  (get: AtomType.Context): ReflowWidgetViewModel => {
    const controls = get(reflowControlsAtom)
    const run = get(surfaceRunStateAtom("effect-text"))
    const isAnimating = get(animatingAtom)
    const manualProjection = get(reflowProjectionAtom)
    const activeAuthority = runUsesActiveFrameAuthority(run)
      ? resolveActiveEffectTextAuthority({
        frame: get(surfaceActiveLocalRunFrameAtom("effect-text")),
        plan: get(surfaceActiveLocalRunPlanAtom("effect-text"))
      })
      : null
    const projection = resolveReflowProjection({
      activeFrame: activeAuthority?.frame ?? null,
      manualProjection
    })
    const selectedCorpusIndex = activeAuthority?.frame.controls.corpusIndex ?? controls.corpusIndex
    const customText = get(customTextAtom)
    const entry = resolveReflowCorpusEntry(selectedCorpusIndex, activeAuthority?.plan.customText ?? customText)
    const viewportWidthPx = activeAuthority?.plan.viewportWidthPx ?? get(reflowStageViewportWidthAtom)
    const stageMaxWidth = resolveReflowStageMaxWidth(viewportWidthPx)
    const obstaclesEnabled = activeAuthority?.frame.controls.obstaclesEnabled ?? controls.obstaclesEnabled
    const stageMinWidth = reflowMinWidthFor(stageMaxWidth, obstaclesEnabled, entry.scene.obstacles)
    const width = activeAuthority?.frame.projection.stageWidthPx ?? resolveReflowStageWidth(
      controls.width,
      viewportWidthPx,
      controls.obstaclesEnabled,
      entry.scene.obstacles
    )
    const usingCustomText = selectedCorpusIndex >= corpus.length
    const stage = projection === null ? null : reflowStage(projection)

    return {
      corpusOptions: Arr.append(
        Arr.map(corpus, (corpusEntry, index) => ({ index, label: corpusEntry.label })),
        { index: corpus.length, label: "Your text" }
      ),
      selectedCorpusIndex,
      usingCustomText,
      customText: usingCustomText && activeAuthority !== null
        ? activeAuthority.frame.projection.corpusText
        : customText,
      width: {
        value: width,
        min: stageMinWidth,
        max: stageMaxWidth,
        display: `${width}px`
      },
      obstaclesEnabled,
      isAnimating: runShowsAnimatingState(run, isAnimating),
      metrics: stage === null ? [] : reflowMetrics({ obstaclesEnabled, projection: stage }),
      lines: projection?.lines ?? [],
      stage
    }
  }
)
