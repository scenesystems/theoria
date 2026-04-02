import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { DspRunFrame, DspStageId } from "../../contracts/demo/dsp-runtime.js"
import {
  type DspModuleType,
  dspModuleTypeOptions,
  type DspScenarioDefinition,
  type DspScenarioId,
  dspScenarioOptions,
  dspScenarios,
  moduleTypeFromIndex,
  moduleTypeToIndex,
  scenarioById
} from "../../contracts/demo/dsp.js"
import { runShowsAnimatingState, runUsesActiveFrameAuthority } from "../state/run-interaction.js"
import type { MetricAppearance } from "../view/primitives/designSystem.js"
import type { EffectDspRunPlan } from "./dsp-run-plan.js"
import { dspModuleTypeIndexAtom, dspOptimizationBudgetAtom, dspScenarioIndexAtom } from "./dsp-widget.js"
import { surfaceLocalRunFrameAtom, surfaceLocalRunPlanAtom, surfaceRunStateAtom } from "./surface.js"
import type { WidgetMetric } from "./widget-view-models.js"

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

const moduleTypeLabel = (moduleType: DspModuleType): string =>
  moduleType === "chainOfThought" ? "Chain of Thought" : "Predict"

const metricDisplay = (value: number | null): string => value === null ? "—" : `${(value * 100).toFixed(1)}%`
const deltaDisplay = (value: number | null): string =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`
const countDisplay = (value: number | null): string => value === null ? "—" : `${value}`

const scenarioIndexFor = (scenarioId: DspScenarioId): number => {
  const index = dspScenarios.findIndex((scenario) => scenario.id === scenarioId)

  return index === -1 ? 0 : index
}

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

const runtimeMetrics = (frame: DspRunFrame): ReadonlyArray<WidgetMetric> => [
  { label: "Baseline", value: metricDisplay(frame.metrics.baselineAccuracy), appearance: neutralAppearance },
  { label: "Optimized", value: metricDisplay(frame.metrics.optimizedAccuracy), appearance: dspToneAppearance },
  { label: "Demos", value: countDisplay(frame.metrics.demosLearned), appearance: neutralAppearance },
  { label: "Delta", value: deltaDisplay(frame.metrics.improvementDelta), appearance: dspToneAppearance }
]

type NonDspPlan = { readonly _tag: "effect-text" } | { readonly _tag: "effect-math" } | {
  readonly _tag: "effect-search"
}
type NonDspFrame = { readonly _tag: "effect-text" } | { readonly _tag: "effect-math" } | {
  readonly _tag: "effect-search"
}

const frozenPlanOrNull = (plan: EffectDspRunPlan | NonDspPlan | null): EffectDspRunPlan | null =>
  plan !== null && plan._tag === "effect-dsp" ? plan : null

const frameOrNull = (frame: DspRunFrame | NonDspFrame | null): DspRunFrame | null =>
  frame !== null && frame._tag === "effect-dsp" ? frame : null

export type DspWidgetViewModel = {
  readonly scenario: DspScenarioDefinition
  readonly scenarioIndex: number
  readonly scenarioOptions: ReadonlyArray<{ readonly index: number; readonly label: string }>
  readonly moduleType: DspModuleType
  readonly moduleTypeIndex: number
  readonly moduleTypeOptions: ReadonlyArray<{ readonly index: number; readonly label: string }>
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
  const idleScenarioIndex = get(dspScenarioIndexAtom)
  const idleModuleTypeIndex = get(dspModuleTypeIndexAtom)
  const idleModuleType = moduleTypeFromIndex(idleModuleTypeIndex)
  const idleBudget = get(dspOptimizationBudgetAtom)
  const frozenPlan = runUsesActiveFrameAuthority(run)
    ? frozenPlanOrNull(get(surfaceLocalRunPlanAtom("effect-dsp")))
    : null
  const frame = runUsesActiveFrameAuthority(run)
    ? frameOrNull(get(surfaceLocalRunFrameAtom("effect-dsp")))
    : null
  const scenario = frozenPlan === null
    ? scenarioById(dspScenarios[idleScenarioIndex]?.id ?? "intervention-classifier")
    : scenarioById(frozenPlan.scenarioId)
  const scenarioIndex = frozenPlan === null ? idleScenarioIndex : scenarioIndexFor(frozenPlan.scenarioId)
  const moduleType = frozenPlan === null ? idleModuleType : frozenPlan.moduleType
  const moduleTypeIndex = frozenPlan === null ? idleModuleTypeIndex : moduleTypeToIndex(frozenPlan.moduleType)
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
    scenarioIndex,
    scenarioOptions: dspScenarioOptions,
    moduleType,
    moduleTypeIndex,
    moduleTypeOptions: dspModuleTypeOptions,
    optimizationBudget: { value: budget, min: 1, max: 5, step: 1, display: `${budget} rounds` },
    controlsLocked: frozenPlan !== null,
    runtimeStatus,
    metrics: frame !== null
      ? runtimeMetrics(frame)
      : frozenPlan !== null
      ? plannedMetrics({ moduleType, optimizationBudget: budget, scenario })
      : playgroundMetrics(scenario),
    isAnimating: runShowsAnimatingState(run, frame !== null)
  }
})
