import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Option } from "effect"
import type { Text } from "effect-text"
import * as Arr from "effect/Array"

import { corpus } from "../../contracts/corpus.js"
import type { Obstacle } from "../../contracts/obstacle.js"
import {
  isEffectMathRunFrame,
  isEffectMathRunPlan,
  isEffectTextRunFrame,
  isEffectTextRunPlan,
  type LocalRunFrame,
  type LocalRunPlan
} from "../state/local-run.js"
import type { ReflowStageLine, ReflowStageObstacle } from "../text/obstacleProjection.js"
import type { MetricAppearance } from "../view/primitives/designSystem.js"
import { animatingAtom } from "./animation.js"
import type { OptimizationProjection } from "./optimization-animation.js"
import { optimizationAnimatingAtom, optimizationProjectionAtom } from "./optimization-animation.js"
import type { PowerProjection } from "./power-animation.js"
import { powerAnimatingAtom, powerProjectionAtom } from "./power-animation.js"
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
import { surfaceActiveLocalRunFrameAtom, surfaceActiveLocalRunPlanAtom } from "./surface.js"

export type WidgetMetric = {
  readonly label: string
  readonly value: string
  readonly appearance?: MetricAppearance
  readonly enabled?: boolean
}

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

const metric = (
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

const reflowMetrics = ({
  obstaclesEnabled,
  projection
}: {
  readonly obstaclesEnabled: boolean
  readonly projection: NonNullable<ReflowWidgetViewModel["stage"]>
}): ReadonlyArray<WidgetMetric> => [
  metric("Lines", String(projection.summary.lineCount)),
  metric("Width", `${projection.effectiveWidthPx}px`),
  metric("Obstacles", String(projection.sceneObstacles.length), {
    appearance: { _tag: "tone", tone: "text" },
    enabled: obstaclesEnabled
  }),
  metric(
    "Line Δ",
    `${projection.obstacleDelta >= 0 ? "+" : ""}${projection.obstacleDelta}`,
    {
      appearance: { _tag: "tone", tone: "text" },
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

const resolveActiveEffectMathAuthority = ({
  frame,
  plan
}: {
  readonly frame: LocalRunFrame | null
  readonly plan: LocalRunPlan | null
}): {
  readonly frame: Extract<LocalRunFrame, { readonly _tag: "effect-math" }>
  readonly plan: Extract<LocalRunPlan, { readonly _tag: "effect-math" }>
} | null =>
  isEffectMathRunPlan(plan) && isEffectMathRunFrame(frame)
    ? { frame, plan }
    : null

export const reflowWidgetViewModelAtom: AtomType.Atom<ReflowWidgetViewModel> = Atom.make(
  (get: AtomType.Context): ReflowWidgetViewModel => {
    const controls = get(reflowControlsAtom)
    const manualProjection = get(reflowProjectionAtom)
    const activeAuthority = resolveActiveEffectTextAuthority({
      frame: get(surfaceActiveLocalRunFrameAtom("effect-text")),
      plan: get(surfaceActiveLocalRunPlanAtom("effect-text"))
    })
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
        Arr.map(corpus, (entry, index) => ({ index, label: entry.label })),
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
      isAnimating: get(animatingAtom),
      metrics: stage === null ? [] : reflowMetrics({ obstaclesEnabled, projection: stage }),
      lines: projection?.lines ?? [],
      stage
    }
  }
)

export type OptimizationWidgetViewModel = {
  readonly budget: {
    readonly value: number
    readonly min: number
    readonly max: number
    readonly step: number
    readonly display: string
  }
  readonly isAnimating: boolean
  readonly metrics: ReadonlyArray<WidgetMetric>
  readonly projection: OptimizationProjection
}

const optionDisplay = (value: Option.Option<number>, digits: number): string =>
  Option.match(value, {
    onNone: () => "—",
    onSome: (next) => next.toFixed(digits)
  })

const mathMetricAppearance: MetricAppearance = { _tag: "tone", tone: "math" }
const neutralMetricAppearance: MetricAppearance = { _tag: "neutral" }
const dangerMetricAppearance: MetricAppearance = { _tag: "danger" }

export const optimizationWidgetViewModelAtom: AtomType.Atom<OptimizationWidgetViewModel> = Atom.make(
  (get: AtomType.Context): OptimizationWidgetViewModel => {
    const projection = get(optimizationProjectionAtom)
    const improvement = Option.zipWith(
      projection.tpeBestValue,
      projection.randomBestValue,
      (tpeBest, randomBest) => `${((1 - tpeBest / randomBest) * 100).toFixed(1)}%`
    )

    return {
      budget: {
        value: projection.trialBudget,
        min: 10,
        max: 100,
        step: 5,
        display: `${projection.trialBudget}`
      },
      isAnimating: get(optimizationAnimatingAtom),
      metrics: [
        {
          label: "TPE best",
          value: optionDisplay(projection.tpeBestValue, 4),
          appearance: { _tag: "tone", tone: "search" }
        },
        { label: "Random best", value: optionDisplay(projection.randomBestValue, 4) },
        {
          label: "Improvement",
          value: Option.getOrElse(improvement, () => "—"),
          appearance: { _tag: "tone", tone: "search" }
        },
        { label: "Trials", value: `${projection.tpeTrials.length}/${projection.trialBudget}` }
      ],
      projection
    }
  }
)

export type PowerWidgetViewModel = {
  readonly controls: {
    readonly effectSize: {
      readonly value: number
      readonly min: number
      readonly max: number
      readonly step: number
      readonly display: string
    }
    readonly sampleSize: {
      readonly value: number
      readonly min: number
      readonly max: number
      readonly step: number
      readonly display: string
    }
    readonly alpha: {
      readonly value: number
      readonly min: number
      readonly max: number
      readonly step: number
      readonly display: string
    }
  }
  readonly isAnimating: boolean
  readonly metrics: ReadonlyArray<WidgetMetric>
  readonly projection: PowerProjection
}

const powerMetricAppearance = (powerValue: number): MetricAppearance =>
  Match.value(powerValue >= 0.8).pipe(
    Match.when(true, () => mathMetricAppearance),
    Match.orElse(() =>
      Match.value(powerValue >= 0.5).pipe(
        Match.when(true, () => neutralMetricAppearance),
        Match.orElse(() => dangerMetricAppearance)
      )
    )
  )

export const powerWidgetViewModelAtom: AtomType.Atom<PowerWidgetViewModel> = Atom.make(
  (get: AtomType.Context): PowerWidgetViewModel => {
    const activeAuthority = resolveActiveEffectMathAuthority({
      frame: get(surfaceActiveLocalRunFrameAtom("effect-math")),
      plan: get(surfaceActiveLocalRunPlanAtom("effect-math"))
    })
    const projection = activeAuthority?.frame.projection ?? get(powerProjectionAtom)
    const controls = activeAuthority?.frame.controls ?? {
      d: projection.d,
      n: projection.n,
      alpha: projection.alpha
    }

    return {
      controls: {
        effectSize: {
          value: controls.d,
          min: 0.1,
          max: 2.0,
          step: 0.05,
          display: controls.d.toFixed(2)
        },
        sampleSize: {
          value: controls.n,
          min: 5,
          max: 200,
          step: 1,
          display: `${controls.n}`
        },
        alpha: {
          value: controls.alpha,
          min: 0.01,
          max: 0.1,
          step: 0.01,
          display: controls.alpha.toFixed(2)
        }
      },
      isAnimating: get(powerAnimatingAtom),
      metrics: [
        {
          label: "Power",
          value: `${(projection.power * 100).toFixed(1)}%`,
          appearance: powerMetricAppearance(projection.power)
        },
        { label: "N for 80%", value: Number.isFinite(projection.requiredN) ? `${projection.requiredN}` : "∞" },
        { label: "Overlap", value: `${(projection.overlap * 100).toFixed(1)}%` },
        { label: "δ", value: projection.nonCentrality.toFixed(2) }
      ],
      projection
    }
  }
)
