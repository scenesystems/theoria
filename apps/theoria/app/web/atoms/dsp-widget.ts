import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import { defaultDspModuleType, defaultOptimizationBudget, moduleTypeToIndex } from "../../contracts/demo/dsp.js"
export { type EffectDspRunPlan, snapshotEffectDspRunPlan } from "./dsp-run-plan.js"

export const dspScenarioIndexAtom: AtomType.Writable<number> = Atom.make(0)

export const dspModuleTypeIndexAtom: AtomType.Writable<number> = Atom.make(
  moduleTypeToIndex(defaultDspModuleType)
)

export const dspOptimizationBudgetAtom: AtomType.Writable<number> = Atom.make(
  defaultOptimizationBudget
)

export const selectDspScenarioAtom = Atom.fnSync<number>()((index, ctx) => {
  ctx.set(dspScenarioIndexAtom, index)
})

export const selectDspModuleTypeAtom = Atom.fnSync<number>()((index, ctx) => {
  ctx.set(dspModuleTypeIndexAtom, index)
})

export const setDspOptimizationBudgetAtom = Atom.fnSync<number>()((value, ctx) => {
  ctx.set(dspOptimizationBudgetAtom, value)
})
