import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match } from "effect"

import {
  type EffectMathProjectionScript,
  isEffectMathProjectionScript,
  powerAlphaMax,
  powerAlphaMin,
  powerAlphaStep,
  PowerControls,
  powerEffectSizeMax,
  powerEffectSizeMin,
  powerEffectSizeStep,
  PowerProjection,
  powerSampleSizeMax,
  powerSampleSizeMin,
  powerSampleSizeStep
} from "../../contracts/capability/effect-math.js"
import type { EffectMathCanonicalStep } from "../../contracts/capability/effect-math.js"
import {
  type PresentationMetric,
  presentationMetric,
  type PresentationMetricAppearance,
  presentationMetricDangerAppearance,
  presentationMetricNeutralAppearance,
  presentationMetricToneAppearance
} from "../../contracts/presentation/metric.js"
import type { CanonicalFrame } from "../../contracts/study/workflow/canonical-step.js"
import { runUsesActiveFrameAuthority } from "../state/run/interaction.js"
import { powerProjectionAtom } from "./run/power-animation.js"
import {
  surfaceActiveCanonicalFrameAtom,
  surfaceActiveLocalProjectionScriptAtom,
  surfaceRunStateAtom
} from "./surface/state.js"
import { widgetRuntimeState } from "./widget-view-model-shared.js"

const firstPlannedPowerControls = (plan: EffectMathProjectionScript): EffectMathProjectionScript["baseControls"] =>
  plan.phases[0]?.steps[0] ?? plan.baseControls

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
  readonly controlsLocked: boolean
  readonly isAnimating: boolean
  readonly statusText: string | null
  readonly metrics: ReadonlyArray<PresentationMetric>
  readonly projection: PowerProjection
}

const isEffectMathCanonicalStep = (
  step: { readonly _tag: string }
): step is typeof EffectMathCanonicalStep.Type => step._tag === "EffectMathCanonicalStep"

const resolveActiveEffectMathAuthority = ({
  canonicalFrame,
  plan
}: {
  readonly canonicalFrame: CanonicalFrame | null
  readonly plan: { readonly _tag: string } | null
}): {
  readonly step: typeof EffectMathCanonicalStep.Type
  readonly plan: EffectMathProjectionScript
} | null =>
  isEffectMathProjectionScript(plan) && canonicalFrame !== null && isEffectMathCanonicalStep(canonicalFrame.step)
    ? { step: canonicalFrame.step, plan }
    : null

const mathMetricAppearance = presentationMetricToneAppearance("math")
const neutralMetricAppearance = presentationMetricNeutralAppearance()
const dangerMetricAppearance = presentationMetricDangerAppearance()

const powerMetricAppearance = (powerValue: number): PresentationMetricAppearance =>
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
    const run = get(surfaceRunStateAtom("effect-math"))
    const runtime = widgetRuntimeState(run)
    const frozenPlan = runUsesActiveFrameAuthority(run)
      ? get(surfaceActiveLocalProjectionScriptAtom("effect-math"))
      : null
    const activeAuthority = runUsesActiveFrameAuthority(run)
      ? resolveActiveEffectMathAuthority({
        canonicalFrame: get(surfaceActiveCanonicalFrameAtom("effect-math")),
        plan: frozenPlan
      })
      : null
    const frozenControls = isEffectMathProjectionScript(frozenPlan)
      ? firstPlannedPowerControls(frozenPlan)
      : null
    const projection = activeAuthority?.step.projection
      ?? (frozenControls === null ? get(powerProjectionAtom) : PowerProjection.project(frozenControls))
    const powerReport = projection.powerReport
    const sampleSizeReport = projection.sampleSizeReport
    const controls = activeAuthority?.step.controls ?? frozenControls ?? {
      d: powerReport.effectSize,
      n: powerReport.sampleSize,
      alpha: powerReport.alpha
    }
    const projectedControls = PowerControls.make(controls)

    return {
      controls: {
        effectSize: {
          value: projectedControls.d,
          min: powerEffectSizeMin,
          max: powerEffectSizeMax,
          step: powerEffectSizeStep,
          display: projectedControls.d.toFixed(2)
        },
        sampleSize: {
          value: projectedControls.n,
          min: powerSampleSizeMin,
          max: powerSampleSizeMax,
          step: powerSampleSizeStep,
          display: `${projectedControls.n}`
        },
        alpha: {
          value: projectedControls.alpha,
          min: powerAlphaMin,
          max: powerAlphaMax,
          step: powerAlphaStep,
          display: projectedControls.alpha.toFixed(2)
        }
      },
      controlsLocked: runtime.controlsLocked,
      isAnimating: runtime.isAnimating,
      statusText: runtime.statusText,
      metrics: [
        presentationMetric("Power", `${(powerReport.power * 100).toFixed(1)}%`, {
          appearance: powerMetricAppearance(powerReport.power)
        }),
        presentationMetric(
          "N for 80%",
          sampleSizeReport.solver.status === "converged" ? `${sampleSizeReport.sampleSize}` : "∞"
        ),
        presentationMetric("Overlap", `${(projection.overlap * 100).toFixed(1)}%`),
        presentationMetric("δ", powerReport.noncentrality.toFixed(2))
      ],
      projection
    }
  }
)
