import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { CanonicalFrame } from "../../contracts/canonical-step.js"
import type { DspCanonicalStep } from "../../contracts/demo/dsp-runtime.js"
import { type DspStageId } from "../../contracts/demo/dsp-runtime.js"
import {
  dspModuleLabels,
  type DspModuleType,
  dspModuleTypeOptions,
  type DspScenarioDefinition,
  type DspScenarioId,
  dspScenarioOptions,
  scenarioById
} from "../../contracts/demo/dsp.js"
import { runUsesActiveFrameAuthority } from "../state/run-interaction.js"
import type { MetricAppearance } from "../view/primitives/designSystem.js"
import { type EffectDspRunPlan, isEffectDspRunPlan } from "./dsp-run-plan.js"
import { dspModuleTypeAtom, dspOptimizationBudgetAtom, dspScenarioIdAtom } from "./dsp-widget.js"
import { surfaceActiveCanonicalFrameAtom, surfaceLocalRunPlanAtom, surfaceRunStateAtom } from "./surface.js"
import { type WidgetMetric, widgetRuntimeState } from "./widget-view-model-shared.js"

const dspToneAppearance: MetricAppearance = { _tag: "tone", tone: "dsp" }
const neutralAppearance: MetricAppearance = { _tag: "neutral" }

const stageLabel = (stageId: DspStageId): string =>
  stageId === "signature"
    ? "Signature"
    : stageId === "baseline"
    ? "Baseline evaluation"
    : stageId === "optimizing"
    ? "Optimization"
    : stageId === "optimized-eval"
    ? "Optimized evaluation"
    : "Comparison"

const stageDetail = (stageId: DspStageId): string =>
  stageId === "signature"
    ? "The server is freezing the scenario contract and module shape into shared runtime authority."
    : stageId === "baseline"
    ? "The frozen module is being scored against the labeled scenario dataset."
    : stageId === "optimizing"
    ? "BootstrapFewShot is learning demonstrations without letting idle controls rewrite the run."
    : stageId === "optimized-eval"
    ? "The optimized module is being scored against the same dataset for a clean comparison."
    : "The widget and evidence now converge on the same final DSP metrics."

const moduleTypeLabel = (moduleType: DspModuleType): string => dspModuleLabels[moduleType]

const metricDisplay = (value: number | null): string => value === null ? "—" : `${(value * 100).toFixed(1)}%`
const deltaDisplay = (value: number | null): string =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`
const countDisplay = (value: number | null): string => value === null ? "—" : `${value}`

const playgroundMetrics = (scenario: DspScenarioDefinition): ReadonlyArray<WidgetMetric> => [
  {
    label: "Fields",
    value: `${scenario.contract.inputFields.length}→${scenario.contract.outputFields.length}`,
    appearance: dspToneAppearance
  },
  { label: "Examples", value: `${scenario.examples.length}`, appearance: neutralAppearance },
  { label: "Metric", value: scenario.metricName, appearance: neutralAppearance },
  { label: "Invariant", value: scenario.invariant, appearance: dspToneAppearance }
]

const plannedMetrics = ({
  moduleType,
  optimizationBudget,
  scenario
}: {
  readonly moduleType: DspModuleType
  readonly optimizationBudget: number
  readonly scenario: DspScenarioDefinition
}): ReadonlyArray<WidgetMetric> => [
  { label: "Module", value: moduleTypeLabel(moduleType), appearance: dspToneAppearance },
  { label: "Rounds", value: `${optimizationBudget}`, appearance: neutralAppearance },
  { label: "Metric", value: scenario.metricName, appearance: neutralAppearance },
  { label: "Invariant", value: scenario.invariant, appearance: dspToneAppearance }
]

const runtimeMetrics = (step: typeof DspCanonicalStep.Type): ReadonlyArray<WidgetMetric> => [
  { label: "Baseline", value: metricDisplay(step.metrics.baselineAccuracy), appearance: neutralAppearance },
  { label: "Optimized", value: metricDisplay(step.metrics.optimizedAccuracy), appearance: dspToneAppearance },
  { label: "Demos", value: countDisplay(step.metrics.demosLearned), appearance: neutralAppearance },
  { label: "Delta", value: deltaDisplay(step.metrics.improvementDelta), appearance: dspToneAppearance }
]

const frozenPlanOrNull = (plan: { readonly _tag: string } | null): EffectDspRunPlan | null =>
  isEffectDspRunPlan(plan) ? plan : null

const canonicalStepOrNull = (
  frame: CanonicalFrame | null
): typeof DspCanonicalStep.Type | null => frame !== null && frame.step._tag === "DspCanonicalStep" ? frame.step : null

export type DspWidgetViewModel = {
  readonly scenario: DspScenarioDefinition
  readonly scenarioId: DspScenarioId
  readonly scenarioOptions: ReadonlyArray<{ readonly value: DspScenarioId; readonly label: string }>
  readonly moduleType: DspModuleType
  readonly moduleTypeOptions: ReadonlyArray<{ readonly value: DspModuleType; readonly label: string }>
  readonly optimizationBudget: {
    readonly value: number
    readonly min: number
    readonly max: number
    readonly step: number
    readonly display: string
  }
  readonly controlsLocked: boolean
  readonly runtimeStatus: {
    readonly stageId: DspStageId | null
    readonly title: string
    readonly detail: string
  } | null
  readonly metrics: ReadonlyArray<WidgetMetric>
  readonly isAnimating: boolean
}

export const dspWidgetViewModelAtom: AtomType.Atom<DspWidgetViewModel> = Atom.make((get: AtomType.Context) => {
  const run = get(surfaceRunStateAtom("effect-dsp"))
  const runtime = widgetRuntimeState(run)
  const idleScenarioId = get(dspScenarioIdAtom)
  const idleModuleType = get(dspModuleTypeAtom)
  const idleBudget = get(dspOptimizationBudgetAtom)
  const frozenPlan = runUsesActiveFrameAuthority(run)
    ? frozenPlanOrNull(get(surfaceLocalRunPlanAtom("effect-dsp")))
    : null
  const frame = runUsesActiveFrameAuthority(run)
    ? canonicalStepOrNull(get(surfaceActiveCanonicalFrameAtom("effect-dsp")))
    : null
  const scenario = frozenPlan === null
    ? scenarioById(idleScenarioId)
    : scenarioById(frozenPlan.scenarioId)
  const scenarioId = frozenPlan === null ? idleScenarioId : frozenPlan.scenarioId
  const moduleType = frozenPlan === null ? idleModuleType : frozenPlan.moduleType
  const budget = frozenPlan === null ? idleBudget : frozenPlan.optimizationBudget
  const runtimeStatus = frame !== null
    ? {
      stageId: frame.stageId,
      title: `${stageLabel(frame.stageId)} · ${frame.stepIndex}/${frame.stepCount}`,
      detail: stageDetail(frame.stageId)
    }
    : frozenPlan !== null
    ? {
      stageId: null,
      title: "Run frozen to approved manifest",
      detail: `${scenario.label} · ${moduleTypeLabel(moduleType)} · ${budget} rounds`
    }
    : null

  return {
    scenario,
    scenarioId,
    scenarioOptions: dspScenarioOptions,
    moduleType,
    moduleTypeOptions: dspModuleTypeOptions,
    optimizationBudget: { value: budget, min: 1, max: 5, step: 1, display: `${budget} rounds` },
    controlsLocked: runtime.controlsLocked,
    runtimeStatus,
    metrics: frame !== null
      ? runtimeMetrics(frame)
      : frozenPlan !== null
      ? plannedMetrics({ moduleType, optimizationBudget: budget, scenario })
      : playgroundMetrics(scenario),
    isAnimating: runtime.isAnimating
  }
})
