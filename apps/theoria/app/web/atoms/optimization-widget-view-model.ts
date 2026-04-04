import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Option } from "effect"

import {
  optimizationTrialBudgetMax,
  optimizationTrialBudgetMin,
  optimizationTrialBudgetStep
} from "../../contracts/demo/objective.js"
import { isEffectSearchRunPlan, type LocalRunPlan } from "../state/local-run.js"
import { runShowsAnimatingState } from "../state/run-interaction.js"
import type { OptimizationProjection } from "./optimization-animation.js"
import { optimizationAnimatingAtom, optimizationProjectionAtom } from "./optimization-animation.js"
import { surfaceActiveLocalRunPlanAtom, surfaceRunStateAtom } from "./surface.js"
import { type WidgetMetric, widgetMetric } from "./widget-view-model-shared.js"

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

const resolveActiveEffectSearchAuthority = (
  plan: LocalRunPlan | null
): Extract<LocalRunPlan, { readonly _tag: "effect-search" }> | null => isEffectSearchRunPlan(plan) ? plan : null

export const optimizationWidgetViewModelAtom: AtomType.Atom<OptimizationWidgetViewModel> = Atom.make(
  (get: AtomType.Context): OptimizationWidgetViewModel => {
    const run = get(surfaceRunStateAtom("effect-search"))
    const projection = get(optimizationProjectionAtom)
    const activePlan = runShowsAnimatingState(run, get(optimizationAnimatingAtom))
      ? resolveActiveEffectSearchAuthority(get(surfaceActiveLocalRunPlanAtom("effect-search")))
      : null
    const improvement = Option.zipWith(
      projection.tpeBestValue,
      projection.randomBestValue,
      (tpeBest, randomBest) => `${((1 - tpeBest / randomBest) * 100).toFixed(1)}%`
    )
    const trialBudget = activePlan?.trialBudget ?? projection.trialBudget

    return {
      budget: {
        value: trialBudget,
        min: optimizationTrialBudgetMin,
        max: optimizationTrialBudgetMax,
        step: optimizationTrialBudgetStep,
        display: `${trialBudget}`
      },
      isAnimating: runShowsAnimatingState(run, get(optimizationAnimatingAtom)),
      metrics: [
        widgetMetric("TPE best", optionDisplay(projection.tpeBestValue, 4), {
          appearance: { _tag: "tone", tone: "search" }
        }),
        widgetMetric("Random best", optionDisplay(projection.randomBestValue, 4)),
        widgetMetric("Improvement", Option.getOrElse(improvement, () => "—"), {
          appearance: { _tag: "tone", tone: "search" }
        }),
        widgetMetric("Trials", `${projection.tpeTrials.length}/${trialBudget}`)
      ],
      projection
    }
  }
)
