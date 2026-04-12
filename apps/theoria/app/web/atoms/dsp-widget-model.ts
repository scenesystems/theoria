import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import { dspStageDetail, dspStageLabel } from "../../contracts/capability/effect-dsp-runtime-presentation.js"
import type { DspCanonicalStep } from "../../contracts/capability/effect-dsp-runtime.js"
import { type DspStageId } from "../../contracts/capability/effect-dsp-runtime.js"
import {
  type DspModuleType,
  DspModuleTypeOption,
  DspScenarioDefinition,
  type DspScenarioId,
  DspScenarioOption
} from "../../contracts/capability/effect-dsp.js"
import {
  type PresentationMetric,
  presentationMetric,
  presentationMetricNeutralAppearance,
  presentationMetricToneAppearance
} from "../../contracts/presentation/metric.js"
import type { CanonicalFrame } from "../../contracts/study/workflow/canonical-step.js"
import { runUsesActiveFrameAuthority } from "../state/run/interaction.js"
import type { TypedChoicePillOption } from "../view/primitives/choice-pill-model.js"
import { type EffectDspProjectionScript, isEffectDspProjectionScript } from "./dsp-run-plan.js"
import { dspModuleTypeAtom, dspOptimizationBudgetAtom, dspScenarioIdAtom } from "./dsp-widget.js"
import {
  surfaceActiveCanonicalFrameAtom,
  surfaceLocalProjectionScriptAtom,
  surfaceRunStateAtom
} from "./surface/state.js"
import { widgetRuntimeState } from "./widget-view-model-shared.js"

const dspToneAppearance = presentationMetricToneAppearance("dsp")
const neutralAppearance = presentationMetricNeutralAppearance()

const moduleTypeLabel = (moduleType: DspModuleType): string => DspModuleTypeOption.label(moduleType)

const metricDisplay = (value: number | null): string => value === null ? "—" : `${(value * 100).toFixed(1)}%`
const deltaDisplay = (value: number | null): string =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`
const countDisplay = (value: number | null): string => value === null ? "—" : `${value}`

const playgroundMetrics = (scenario: DspScenarioDefinition): ReadonlyArray<PresentationMetric> => [
  presentationMetric(
    "Fields",
    `${scenario.contract.inputFields.length}→${scenario.contract.outputFields.length}`,
    { appearance: dspToneAppearance }
  ),
  presentationMetric("Examples", `${scenario.examples.length}`, { appearance: neutralAppearance }),
  presentationMetric("Metric", scenario.metricName, { appearance: neutralAppearance }),
  presentationMetric("Invariant", scenario.invariant, { appearance: dspToneAppearance })
]

const plannedMetrics = ({
  moduleType,
  optimizationBudget,
  scenario
}: {
  readonly moduleType: DspModuleType
  readonly optimizationBudget: number
  readonly scenario: DspScenarioDefinition
}): ReadonlyArray<PresentationMetric> => [
  presentationMetric("Module", moduleTypeLabel(moduleType), { appearance: dspToneAppearance }),
  presentationMetric("Rounds", `${optimizationBudget}`, { appearance: neutralAppearance }),
  presentationMetric("Metric", scenario.metricName, { appearance: neutralAppearance }),
  presentationMetric("Invariant", scenario.invariant, { appearance: dspToneAppearance })
]

const runtimeMetrics = (step: typeof DspCanonicalStep.Type): ReadonlyArray<PresentationMetric> => [
  presentationMetric("Baseline", metricDisplay(step.metrics.baselineAccuracy), { appearance: neutralAppearance }),
  presentationMetric("Optimized", metricDisplay(step.metrics.optimizedAccuracy), { appearance: dspToneAppearance }),
  presentationMetric("Learned", countDisplay(step.metrics.demosLearned), { appearance: neutralAppearance }),
  presentationMetric("Delta", deltaDisplay(step.metrics.improvementDelta), { appearance: dspToneAppearance })
]

const frozenPlanOrNull = (plan: { readonly _tag: string } | null): EffectDspProjectionScript | null =>
  isEffectDspProjectionScript(plan) ? plan : null

const canonicalStepOrNull = (
  frame: CanonicalFrame | null
): typeof DspCanonicalStep.Type | null => frame !== null && frame.step._tag === "DspCanonicalStep" ? frame.step : null

export type DspWidgetViewModel = {
  readonly scenario: DspScenarioDefinition
  readonly scenarioId: DspScenarioId
  readonly scenarioOptions: ReadonlyArray<TypedChoicePillOption<DspScenarioId>>
  readonly moduleType: DspModuleType
  readonly moduleTypeOptions: ReadonlyArray<TypedChoicePillOption<DspModuleType>>
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
  readonly metrics: ReadonlyArray<PresentationMetric>
  readonly isAnimating: boolean
}

export const dspWidgetViewModelAtom: AtomType.Atom<DspWidgetViewModel> = Atom.make((get: AtomType.Context) => {
  const run = get(surfaceRunStateAtom("effect-dsp"))
  const runtime = widgetRuntimeState(run)
  const idleScenarioId = get(dspScenarioIdAtom)
  const idleModuleType = get(dspModuleTypeAtom)
  const idleBudget = get(dspOptimizationBudgetAtom)
  const frozenPlan = runUsesActiveFrameAuthority(run)
    ? frozenPlanOrNull(get(surfaceLocalProjectionScriptAtom("effect-dsp")))
    : null
  const frame = runUsesActiveFrameAuthority(run)
    ? canonicalStepOrNull(get(surfaceActiveCanonicalFrameAtom("effect-dsp")))
    : null
  const scenario = frozenPlan === null
    ? DspScenarioDefinition.forId(idleScenarioId)
    : DspScenarioDefinition.forId(frozenPlan.scenarioId)
  const scenarioId = frozenPlan === null ? idleScenarioId : frozenPlan.scenarioId
  const moduleType = frozenPlan === null ? idleModuleType : frozenPlan.moduleType
  const budget = frozenPlan === null ? idleBudget : frozenPlan.optimizationBudget
  const runtimeStatus = frame !== null
    ? {
      stageId: frame.stageId,
      title: `${dspStageLabel(frame.stageId)} · ${frame.stepIndex}/${frame.stepCount}`,
      detail: dspStageDetail(frame.stageId)
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
    scenarioOptions: DspScenarioOption.catalog(),
    moduleType,
    moduleTypeOptions: DspModuleTypeOption.catalog(),
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
