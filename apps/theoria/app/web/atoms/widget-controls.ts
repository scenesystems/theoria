import { Atom } from "@effect-atom/atom"

import { PowerControls } from "../../contracts/capability/effect-math.js"
import { customTextAtom, reflowControlsAtom } from "./reflow.js"
import { trialBudgetAtom } from "./run/optimization-animation.js"
import { powerControlsAtom } from "./run/power-animation.js"

export const selectReflowCorpusAtom = Atom.fnSync<number>()(
  (index, ctx) => {
    ctx.set(reflowControlsAtom, { ...ctx(reflowControlsAtom), corpusIndex: index })
  }
)

export const setCustomReflowTextAtom = Atom.fnSync<string>()(
  (value, ctx) => {
    ctx.set(customTextAtom, value)
  }
)

export const setReflowWidthValueAtom = Atom.fnSync<number>()(
  (value, ctx) => {
    ctx.set(reflowControlsAtom, { ...ctx(reflowControlsAtom), width: value })
  }
)

export const toggleReflowObstaclesAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(reflowControlsAtom, {
      ...ctx(reflowControlsAtom),
      obstaclesEnabled: !ctx(reflowControlsAtom).obstaclesEnabled
    })
  }
)

export const setOptimizationTrialBudgetAtom = Atom.fnSync<number>()(
  (value, ctx) => {
    ctx.set(trialBudgetAtom, value)
  }
)

export const setPowerEffectSizeAtom = Atom.fnSync<number>()(
  (value, ctx) => {
    ctx.set(powerControlsAtom, PowerControls.make({ ...ctx(powerControlsAtom), d: value }))
  }
)

export const setPowerSampleSizeAtom = Atom.fnSync<number>()(
  (value, ctx) => {
    ctx.set(powerControlsAtom, PowerControls.make({ ...ctx(powerControlsAtom), n: value }))
  }
)

export const setPowerAlphaLevelAtom = Atom.fnSync<number>()(
  (value, ctx) => {
    ctx.set(powerControlsAtom, PowerControls.make({ ...ctx(powerControlsAtom), alpha: value }))
  }
)
