import * as Option from "effect/Option"

import type { TrialPoint } from "./effect-search.js"

const appendBest = (history: ReadonlyArray<number>, value: number): ReadonlyArray<number> => {
  const nextBest = Option.match(Option.fromNullable(history.at(-1)), {
    onNone: () => value,
    onSome: (previousBest) => Math.min(previousBest, value)
  })

  return [...history, nextBest]
}

export const bestHistoryFromTrialPoints = (trials: ReadonlyArray<TrialPoint>): ReadonlyArray<number> =>
  trials.reduce<ReadonlyArray<number>>(
    (history, trial) => appendBest(history, trial.value),
    []
  )
