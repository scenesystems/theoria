import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match } from "effect"

import {
  powerAlphaMax,
  powerAlphaMin,
  powerAlphaStep,
  powerEffectSizeMax,
  powerEffectSizeMin,
  powerEffectSizeStep,
  powerSampleSizeMax,
  powerSampleSizeMin,
  powerSampleSizeStep
} from "../../contracts/demo/power.js"
import { isEffectMathRunFrame, isEffectMathRunPlan, type LocalRunFrame, type LocalRunPlan } from "../state/local-run.js"
import { runShowsAnimatingState, runUsesActiveFrameAuthority } from "../state/run-interaction.js"
import type { MetricAppearance } from "../view/primitives/designSystem.js"
import type { PowerProjection } from "./power-animation.js"
import { powerAnimatingAtom, powerProjectionAtom } from "./power-animation.js"
import { surfaceActiveLocalRunFrameAtom, surfaceActiveLocalRunPlanAtom, surfaceRunStateAtom } from "./surface.js"
import { type WidgetMetric, widgetMetric } from "./widget-view-model-shared.js"

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

const mathMetricAppearance: MetricAppearance = { _tag: "tone", tone: "math" }
const neutralMetricAppearance: MetricAppearance = { _tag: "neutral" }
const dangerMetricAppearance: MetricAppearance = { _tag: "danger" }

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
    const run = get(surfaceRunStateAtom("effect-math"))
    const activeAuthority = runUsesActiveFrameAuthority(run)
      ? resolveActiveEffectMathAuthority({
        frame: get(surfaceActiveLocalRunFrameAtom("effect-math")),
        plan: get(surfaceActiveLocalRunPlanAtom("effect-math"))
      })
      : null
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
          min: powerEffectSizeMin,
          max: powerEffectSizeMax,
          step: powerEffectSizeStep,
          display: controls.d.toFixed(2)
        },
        sampleSize: {
          value: controls.n,
          min: powerSampleSizeMin,
          max: powerSampleSizeMax,
          step: powerSampleSizeStep,
          display: `${controls.n}`
        },
        alpha: {
          value: controls.alpha,
          min: powerAlphaMin,
          max: powerAlphaMax,
          step: powerAlphaStep,
          display: controls.alpha.toFixed(2)
        }
      },
      isAnimating: runShowsAnimatingState(run, get(powerAnimatingAtom)),
      metrics: [
        widgetMetric("Power", `${(projection.power * 100).toFixed(1)}%`, {
          appearance: powerMetricAppearance(projection.power)
        }),
        widgetMetric("N for 80%", Number.isFinite(projection.requiredN) ? `${projection.requiredN}` : "∞"),
        widgetMetric("Overlap", `${(projection.overlap * 100).toFixed(1)}%`),
        widgetMetric("δ", projection.nonCentrality.toFixed(2))
      ],
      projection
    }
  }
)
