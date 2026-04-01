import type { EffectMathRunFrame, EffectMathRunPlan } from "../atoms/power-animation.js"
import type { EffectTextRunFrame, EffectTextRunPlan } from "../atoms/reflow.js"

export type LocalRunPlan = EffectTextRunPlan | EffectMathRunPlan
export type LocalRunFrame = EffectTextRunFrame | EffectMathRunFrame

export const isEffectTextRunPlan = (plan: LocalRunPlan | null): plan is EffectTextRunPlan =>
  plan?._tag === "effect-text"

export const isEffectMathRunPlan = (plan: LocalRunPlan | null): plan is EffectMathRunPlan =>
  plan?._tag === "effect-math"

export const isEffectTextRunFrame = (frame: LocalRunFrame | null): frame is EffectTextRunFrame =>
  frame?._tag === "effect-text"

export const isEffectMathRunFrame = (frame: LocalRunFrame | null): frame is EffectMathRunFrame =>
  frame?._tag === "effect-math"
