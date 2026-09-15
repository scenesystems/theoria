import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema, SortedMap } from "effect"

import * as History from "../src/History.js"
import * as Trial from "../src/Trial.js"

const Record = Trial.makeSchema(Schema.String, Trial.Completed(Schema.String))
const trial = (trialNumber: number, cost: Option.Option<number>) =>
  Record.make({
    trialNumber,
    config: "input",
    state: { _tag: "Completed", value: "observed", duration: 12 },
    ...Option.match(cost, { onNone: () => ({}), onSome: (cost) => ({ cost }) })
  })

it.effect("orders restored trials and counts each trial's latest cost once", () =>
  Effect.gen(function*() {
    const history = History.fromIterable(Arr.make(
      trial(4, Option.some(9)),
      trial(-1, Option.some(2)),
      trial(4, Option.some(3)),
      trial(2, Option.none())
    ))
    expect(Arr.map(History.trials(history), (record) => record.trialNumber)).toEqual(Arr.make(-1, 2, 4))
    expect(history.cumulativeCost).toBe(5)

    const updated = History.setTrial(history, trial(4, Option.some(7)))
    expect(updated.cumulativeCost).toBe(9)
    expect(History.setTrial(updated, trial(4, Option.some(7))).cumulativeCost).toBe(9)
    expect(history.cumulativeCost).toBe(5)
    expect(SortedMap.size(updated.trials)).toBe(3)
  }))

it.effect("ignores absent, negative, and non-finite costs without losing trials", () =>
  Effect.gen(function*() {
    const history = History.fromIterable(Arr.make(
      trial(0, Option.some(-5)),
      trial(1, Option.some(Infinity)),
      trial(2, Option.some(NaN)),
      trial(3, Option.some(2.75)),
      trial(4, Option.none())
    ))
    expect(history.cumulativeCost).toBe(2.75)
    expect(SortedMap.size(history.trials)).toBe(5)
    expect(History.setTrial(history, trial(3, Option.none())).cumulativeCost).toBe(0)
  }))
