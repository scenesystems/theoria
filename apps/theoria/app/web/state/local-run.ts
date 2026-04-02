import type { DspRunFrame } from "../../contracts/demo/dsp-runtime.js"
import type { EffectDspRunPlan } from "../atoms/dsp-run-plan.js"
import type { EffectSearchRunFrame, EffectSearchRunPlan } from "../atoms/optimization-animation.js"
import type { EffectMathRunFrame, EffectMathRunPlan } from "../atoms/power-animation.js"
import type { EffectTextRunFrame, EffectTextRunPlan } from "../atoms/reflow.js"

export type LocalRunPlan = EffectTextRunPlan | EffectSearchRunPlan | EffectMathRunPlan | EffectDspRunPlan
export type LocalRunFrame = EffectTextRunFrame | EffectSearchRunFrame | EffectMathRunFrame | DspRunFrame

export const isEffectTextRunPlan = (plan: LocalRunPlan | null): plan is EffectTextRunPlan =>
  plan?._tag === "effect-text"

export const isEffectSearchRunPlan = (plan: LocalRunPlan | null): plan is EffectSearchRunPlan =>
  plan?._tag === "effect-search"

export const isEffectMathRunPlan = (plan: LocalRunPlan | null): plan is EffectMathRunPlan =>
  plan?._tag === "effect-math"

export const isEffectDspRunPlan = (plan: LocalRunPlan | null): plan is EffectDspRunPlan => plan?._tag === "effect-dsp"

export const isEffectTextRunFrame = (frame: LocalRunFrame | null): frame is EffectTextRunFrame =>
  frame?._tag === "effect-text"

export const isEffectSearchRunFrame = (frame: LocalRunFrame | null): frame is EffectSearchRunFrame =>
  frame?._tag === "effect-search"

export const isEffectMathRunFrame = (frame: LocalRunFrame | null): frame is EffectMathRunFrame =>
  frame?._tag === "effect-math"

export const isEffectDspRunFrame = (frame: LocalRunFrame | null): frame is DspRunFrame => frame?._tag === "effect-dsp"
