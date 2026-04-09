import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import { type DspModuleType, type DspScenarioId } from "../../contracts/capability/effect-dsp.js"
import { defaultEffectDspEntryInput } from "../../contracts/entry/defaults.js"
export { type EffectDspProjectionScript, snapshotEffectDspProjectionScript } from "./dsp-run-plan.js"

export const dspScenarioIdAtom: AtomType.Writable<DspScenarioId> = Atom.make(defaultEffectDspEntryInput.scenarioId)

export const dspModuleTypeAtom: AtomType.Writable<DspModuleType> = Atom.make(defaultEffectDspEntryInput.moduleType)

export const dspOptimizationBudgetAtom: AtomType.Writable<number> = Atom.make(
  defaultEffectDspEntryInput.optimizationBudget
)

export const selectDspScenarioAtom = Atom.fnSync<DspScenarioId>()((scenarioId, ctx) => {
  ctx.set(dspScenarioIdAtom, scenarioId)
})

export const selectDspModuleTypeAtom = Atom.fnSync<DspModuleType>()((moduleType, ctx) => {
  ctx.set(dspModuleTypeAtom, moduleType)
})

export const setDspOptimizationBudgetAtom = Atom.fnSync<number>()((value, ctx) => {
  ctx.set(dspOptimizationBudgetAtom, value)
})
