import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Option } from "effect"

import type { EffectSearchCanonicalStep } from "../../contracts/capability/effect-search.js"
import {
  type EffectSearchProjectionScript,
  isEffectSearchProjectionScript,
  SearchConfig
} from "../../contracts/capability/effect-search.js"
import {
  type PresentationMetric,
  presentationMetric,
  presentationMetricToneAppearance
} from "../../contracts/presentation/metric.js"
import type { CanonicalFrame } from "../../contracts/study/workflow/canonical-step.js"
import { runUsesActiveFrameAuthority } from "../state/run/interaction.js"
import type { OptimizationProjection as OptimizationProjectionShape } from "./run/optimization-animation.js"
import { OptimizationProjection, optimizationProjectionAtom } from "./run/optimization-animation.js"
import {
  surfaceActiveCanonicalFrameAtom,
  surfaceActiveLocalProjectionScriptAtom,
  surfaceRunStateAtom
} from "./surface/state.js"
import { widgetRuntimeState } from "./widget-view-model-shared.js"

const searchTrialBudgetBounds = SearchConfig.bounds()

const frozenOptimizationProjection = (plan: EffectSearchProjectionScript): OptimizationProjectionShape =>
  OptimizationProjection.fromTrials({
    phase: "running",
    randomTrials: [],
    tpeTrials: [],
    trialBudget: plan.trialBudget
  })

export type OptimizationWidgetViewModel = {
  readonly budget: {
    readonly value: number
    readonly min: number
    readonly max: number
    readonly step: number
    readonly display: string
  }
  readonly controlsLocked: boolean
  readonly isAnimating: boolean
  readonly statusText: string | null
  readonly metrics: ReadonlyArray<PresentationMetric>
  readonly projection: OptimizationProjectionShape
}

const optionDisplay = (value: Option.Option<number>, digits: number): string =>
  Option.match(value, {
    onNone: () => "—",
    onSome: (next) => next.toFixed(digits)
  })

const resolveEffectSearchAuthority = ({
  canonicalFrame,
  plan
}: {
  readonly canonicalFrame: CanonicalFrame | null
  readonly plan: { readonly _tag: string } | null
}): {
  readonly step: typeof EffectSearchCanonicalStep.Type
  readonly plan: EffectSearchProjectionScript
} | null =>
  isEffectSearchProjectionScript(plan) && canonicalFrame !== null &&
    canonicalFrame.step._tag === "EffectSearchCanonicalStep"
    ? { step: canonicalFrame.step, plan }
    : null

export const optimizationWidgetViewModelAtom: AtomType.Atom<OptimizationWidgetViewModel> = Atom.make(
  (get: AtomType.Context): OptimizationWidgetViewModel => {
    const run = get(surfaceRunStateAtom("effect-search"))
    const runtime = widgetRuntimeState(run)
    const frozenPlan = runUsesActiveFrameAuthority(run)
      ? get(surfaceActiveLocalProjectionScriptAtom("effect-search"))
      : null
    const authority = runUsesActiveFrameAuthority(run)
      ? resolveEffectSearchAuthority({
        canonicalFrame: get(surfaceActiveCanonicalFrameAtom("effect-search")),
        plan: frozenPlan
      })
      : null
    const projection = authority === null
      ? isEffectSearchProjectionScript(frozenPlan)
        ? frozenOptimizationProjection(frozenPlan)
        : get(optimizationProjectionAtom)
      : OptimizationProjection.fromTrials({
        phase: authority.step.phase,
        randomTrials: authority.step.randomTrials,
        tpeTrials: authority.step.tpeTrials,
        trialBudget: authority.step.trialBudget
      })
    const improvement = Option.zipWith(
      projection.tpeBestValue,
      projection.randomBestValue,
      (tpeBest, randomBest) => `${((1 - tpeBest / randomBest) * 100).toFixed(1)}%`
    )
    const trialBudget = authority?.step.trialBudget
      ?? (isEffectSearchProjectionScript(frozenPlan) ? frozenPlan.trialBudget : null)
      ?? projection.trialBudget
    const searchToneAppearance = presentationMetricToneAppearance("search")

    return {
      budget: {
        value: trialBudget,
        min: searchTrialBudgetBounds.min,
        max: searchTrialBudgetBounds.max,
        step: searchTrialBudgetBounds.step,
        display: `${trialBudget}`
      },
      controlsLocked: runtime.controlsLocked,
      isAnimating: runtime.isAnimating,
      statusText: runtime.statusText,
      metrics: [
        presentationMetric("TPE best", optionDisplay(projection.tpeBestValue, 4), {
          appearance: searchToneAppearance
        }),
        presentationMetric("Random best", optionDisplay(projection.randomBestValue, 4)),
        presentationMetric("Improvement", Option.getOrElse(improvement, () => "—"), {
          appearance: searchToneAppearance
        }),
        presentationMetric("Trials", `${projection.tpeTrials.length}/${trialBudget}`)
      ],
      projection
    }
  }
)
