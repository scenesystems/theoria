import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Text } from "effect-text"
import * as Arr from "effect/Array"

import type { EffectTextProjectionStep } from "../../contracts/capability/effect-text.js"
import { type EffectTextTraversalScript, isEffectTextTraversalScript } from "../../contracts/capability/effect-text.js"
import { corpus } from "../../contracts/corpus.js"
import type { Obstacle } from "../../contracts/obstacle.js"
import type { CanonicalFrame } from "../../contracts/study/workflow/canonical-step.js"
import { runUsesActiveFrameAuthority } from "../state/run/interaction.js"
import { browserSupportProfileId } from "../text/browserTextLayout.js"
import type { ReflowStageLine, ReflowStageObstacle } from "../text/obstacleStageModel.js"
import { choicePillOption, type TypedChoicePillOption } from "../view/primitives/choice-pill-model.js"
import type { MetricAppearance } from "../view/primitives/theme/tone.js"
import {
  customTextAtom,
  type EffectTextRunFrame,
  isEffectTextRunFrame,
  reflowControlsAtom,
  reflowMinWidthFor,
  type ReflowProjection,
  reflowProjectionAtom,
  reflowStageViewportWidthAtom,
  resolveReflowCorpusEntry,
  resolveReflowStageMaxWidth,
  resolveReflowStageWidth
} from "./reflow.js"
import {
  surfaceActiveCanonicalFrameAtom,
  surfaceActiveLocalProjectionScriptAtom,
  surfaceActiveLocalRunFrameAtom,
  surfaceRunStateAtom
} from "./surface/state.js"
import { type WidgetMetric, widgetMetric, widgetRuntimeState } from "./widget-view-model-shared.js"

export type ReflowWidgetViewModel = {
  readonly corpusOptions: ReadonlyArray<TypedChoicePillOption<number>>
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
  readonly controlsLocked: boolean
  readonly isAnimating: boolean
  readonly statusText: string | null
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
  readonly activeFrame: EffectTextRunFrame | null
  readonly manualProjection: ReflowProjection | null
}): ReflowProjection | null => activeFrame?.projection ?? manualProjection

const resolveActiveEffectTextAuthority = ({
  canonicalFrame,
  localFrame,
  plan
}: {
  readonly canonicalFrame: CanonicalFrame | null
  readonly localFrame: { readonly _tag: string } | null
  readonly plan: { readonly _tag: string } | null
}): {
  readonly step: typeof EffectTextProjectionStep.Type
  readonly localFrame: EffectTextRunFrame | null
  readonly plan: EffectTextTraversalScript
} | null =>
  isEffectTextTraversalScript(plan) && canonicalFrame !== null &&
    canonicalFrame.step._tag === "EffectTextProjectionStep"
    ? {
      step: canonicalFrame.step,
      localFrame: isEffectTextRunFrame(localFrame) ? localFrame : null,
      plan
    }
    : null

const firstPlannedReflowStep = (
  plan: EffectTextTraversalScript
): EffectTextTraversalScript["entries"][number]["steps"][number] | null => plan.entries[0]?.steps[0] ?? null

const firstPlannedCorpusIndex = (plan: EffectTextTraversalScript): number => plan.entries[0]?.corpusIndex ?? 0

export const reflowWidgetViewModelAtom: AtomType.Atom<ReflowWidgetViewModel> = Atom.make(
  (get: AtomType.Context): ReflowWidgetViewModel => {
    const controls = get(reflowControlsAtom)
    const run = get(surfaceRunStateAtom("effect-text"))
    const runtime = widgetRuntimeState(run)
    const manualProjection = get(reflowProjectionAtom)
    const frozenPlan = runUsesActiveFrameAuthority(run)
      ? get(surfaceActiveLocalProjectionScriptAtom("effect-text"))
      : null
    const activeAuthority = runUsesActiveFrameAuthority(run)
      ? resolveActiveEffectTextAuthority({
        canonicalFrame: get(surfaceActiveCanonicalFrameAtom("effect-text")),
        localFrame: get(surfaceActiveLocalRunFrameAtom("effect-text")),
        plan: frozenPlan
      })
      : null
    const plannedStep = isEffectTextTraversalScript(frozenPlan) ? firstPlannedReflowStep(frozenPlan) : null
    const projection = runUsesActiveFrameAuthority(run)
      ? activeAuthority?.localFrame?.projection ?? null
      : resolveReflowProjection({
        activeFrame: activeAuthority?.localFrame ?? null,
        manualProjection
      })
    const selectedCorpusIndex = activeAuthority?.step.corpusIndex
      ?? (isEffectTextTraversalScript(frozenPlan) ? firstPlannedCorpusIndex(frozenPlan) : null)
      ?? activeAuthority?.localFrame?.controls.corpusIndex
      ?? controls.corpusIndex
    const customText = get(customTextAtom)
    const entry = resolveReflowCorpusEntry(
      selectedCorpusIndex,
      activeAuthority?.plan.customText ?? (isEffectTextTraversalScript(frozenPlan) ? frozenPlan.customText : customText)
    )
    const viewportWidthPx = activeAuthority?.plan.viewportWidthPx
      ?? (isEffectTextTraversalScript(frozenPlan) ? frozenPlan.viewportWidthPx : null)
      ?? get(reflowStageViewportWidthAtom)
    const stageMaxWidth = resolveReflowStageMaxWidth(viewportWidthPx)
    const obstaclesEnabled = activeAuthority?.step.obstaclesEnabled
      ?? plannedStep?.obstaclesEnabled
      ?? activeAuthority?.localFrame?.controls.obstaclesEnabled
      ?? controls.obstaclesEnabled
    const stageMinWidth = reflowMinWidthFor(stageMaxWidth, obstaclesEnabled, entry.scene.obstacles)
    const width = activeAuthority?.step.stageWidthPx
      ?? plannedStep?.stageWidthPx
      ?? activeAuthority?.localFrame?.projection.stageWidthPx
      ?? resolveReflowStageWidth(
        controls.width,
        viewportWidthPx,
        controls.obstaclesEnabled,
        entry.scene.obstacles
      )
    const usingCustomText = selectedCorpusIndex >= corpus.length
    const stage = projection === null ? null : reflowStage(projection)

    return {
      corpusOptions: Arr.append(
        Arr.map(corpus, (corpusEntry, index) => choicePillOption(index, corpusEntry.label)),
        choicePillOption(corpus.length, "Your text")
      ),
      selectedCorpusIndex,
      usingCustomText,
      customText: usingCustomText && activeAuthority !== null
        ? activeAuthority.localFrame?.projection.corpusText ?? activeAuthority.plan.customText
        : usingCustomText && isEffectTextTraversalScript(frozenPlan)
        ? frozenPlan.customText
        : customText,
      width: {
        value: width,
        min: stageMinWidth,
        max: stageMaxWidth,
        display: `${width}px`
      },
      obstaclesEnabled,
      controlsLocked: runtime.controlsLocked,
      isAnimating: runtime.isAnimating,
      statusText: runtime.statusText,
      metrics: stage === null ? [] : reflowMetrics({ obstaclesEnabled, projection: stage }),
      lines: projection?.lines ?? [],
      stage
    }
  }
)
